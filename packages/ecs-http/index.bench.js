// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
//
// HTTP throughput benchmark for @middy/ecs-http.
// Spawns a real cluster of node:http workers (using `runWorker`), drives
// `autocannon` against them, and reports RPS + latency for each combination
// of (eventVersion, worker count). Single Node script that branches between
// primary and worker via `cluster.isPrimary`.
//
// Run: npm run test:bench

import cluster from "node:cluster";
import { availableParallelism } from "node:os";
import autocannon from "autocannon";
// Bench uses runWorker directly for fine-grained primary/worker control;
// the public-facing entrypoint is `ecsHttpRunner` from ./index.js.
import { runWorker } from "./index.js";

// SCHED_NONE lets every worker accept() directly (SO_REUSEPORT on Linux,
// thundering-herd-with-distribute on macOS). Default SCHED_RR routes through
// the primary process, which becomes a single-threaded bottleneck on a single
// laptop and hides multi-worker scaling.
cluster.schedulingPolicy = cluster.SCHED_NONE;

const PORT = Number(process.env.BENCH_PORT ?? 18080);
const DURATION_S = 10;
const CONNECTIONS_PER_WORKER = 50;
const CLIENT_PIPELINING = 4;

const noopHandler = async () => ({ statusCode: 200, body: "ok" });

const eventVersions = ["2.0", "1.0", "alb"];
const workerCounts = [1, availableParallelism()];

if (cluster.isWorker) {
	// Worker process: bind one HTTP server on the shared port.
	const eventVersion = process.env.BENCH_EVENT_VERSION;
	const { server } = await runWorker({
		handler: noopHandler,
		eventVersion,
		requestContext: {},
		port: PORT,
		timeout: 60_000,
		bodyLimit: 1024 * 1024,
	});
	// Replace runWorker's drain-then-exit with a forceful shutdown so the
	// bench harness can quickly recycle workers between rounds; autocannon's
	// keep-alive connections would otherwise stall a graceful drain.
	process.removeAllListeners("SIGTERM");
	process.once("SIGTERM", () => {
		server.closeAllConnections?.();
		server.close(() => process.exit(0));
	});
	process.send?.("ready");
} else {
	// Primary process: orchestrate runs and print results.
	const results = [];
	for (const workers of workerCounts) {
		for (const eventVersion of eventVersions) {
			console.log(`\n--- eventVersion=${eventVersion}, workers=${workers} ---`);
			const spawned = [];
			const readys = [];
			for (let i = 0; i < workers; i++) {
				const w = cluster.fork({ BENCH_EVENT_VERSION: eventVersion });
				spawned.push(w);
				readys.push(
					new Promise((resolve) => {
						w.once("message", (msg) => {
							if (msg === "ready") resolve();
						});
					}),
				);
			}
			await Promise.all(readys);

			const result = await autocannon({
				url: `http://127.0.0.1:${PORT}/`,
				connections: CONNECTIONS_PER_WORKER * workers,
				pipelining: CLIENT_PIPELINING,
				duration: DURATION_S,
				workers: Math.min(workers, 4),
			});

			console.log(
				`requests=${result.requests.total}  rps_avg=${result.requests.average.toFixed(0)}  ` +
					`p50=${result.latency.p50}ms  p99=${result.latency.p99}ms  ` +
					`avg_latency=${result.latency.average.toFixed(2)}ms`,
			);
			results.push({
				eventVersion,
				workers,
				requests: result.requests.total,
				rpsAvg: Math.round(result.requests.average),
				p50: result.latency.p50,
				p99: result.latency.p99,
				avgLatencyMs: Number(result.latency.average.toFixed(2)),
			});

			for (const w of spawned) w.process.kill("SIGTERM");
			await Promise.all(
				spawned.map(
					(w) =>
						new Promise((resolve) => {
							const t = setTimeout(() => {
								w.process.kill("SIGKILL");
							}, 2000);
							w.once("exit", () => {
								clearTimeout(t);
								resolve();
							});
						}),
				),
			);
			// Brief pause so the OS releases the port before the next round binds.
			await new Promise((r) => setTimeout(r, 250));
		}
	}

	console.log("\n=== Summary ===");
	console.table(results);
	process.exit(0);
}
