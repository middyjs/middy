// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	deepStrictEqual,
	match,
	notStrictEqual,
	ok,
	rejects,
	strictEqual,
	throws,
} from "node:assert/strict";
import nodeCluster from "node:cluster";
import { EventEmitter, getEventListeners } from "node:events";
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { describe, mock, test } from "node:test";
import amqplib from "amqplib";
import stompit from "stompit";
import {
	buildContext,
	drainAndExit,
	ecsBatchRunner,
	ecsBatchValidateOptions,
	fetchEcsMetadata,
	readEcsEnv,
	runPollLoop,
	runPrimary,
	runWorker,
} from "./index.js";
import { pollAmq, pollAmqValidateOptions } from "./pollAmq.js";
import {
	pollDynamoDBStreams,
	pollDynamoDBStreamsValidateOptions,
} from "./pollDynamoDBStreams.js";
import { pollKafka, pollKafkaValidateOptions } from "./pollKafka.js";
import { pollKinesis, pollKinesisValidateOptions } from "./pollKinesis.js";
import { pollRmq, pollRmqValidateOptions } from "./pollRmq.js";
import { pollSqs, pollSqsValidateOptions } from "./pollSqs.js";

// Guard: nothing in this suite may fork real workers. Under mutation testing a
// mutant that drops the injected fake cluster once spawned ~10k processes.
mock.method(nodeCluster, "fork", () => {
	throw new Error("real cluster.fork called in tests");
});

// Guard: nothing in this suite may terminate the test process. node --test
// reports a file that exits 0 mid-run as passing, so a mutant that routed a
// drain to the real process.exit(0) looked green while every later test was
// skipped. Every default-deps path now lands on this throwing double instead.
mock.method(process, "exit", (code) => {
	throw new Error(`real process.exit(${code}) called in tests`);
});

const noop = () => {};
const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const settleMacrotask = () => new Promise((r) => setImmediate(r));
const pendingTimeouts = () =>
	process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;

const makeFakeSqsClient = (responses) => {
	const sent = [];
	let i = 0;
	return {
		sent,
		send: async (cmd) => {
			sent.push(cmd);
			const r = responses[Math.min(i, responses.length - 1)];
			i++;
			if (r instanceof Error) throw r;
			return r;
		},
	};
};

const stubPoller = (events = []) => ({
	source: "test",
	acked: [],
	async *poll(signal) {
		for (const e of events) {
			if (signal.aborted) return;
			yield e;
		}
	},
	async acknowledge(event, response) {
		this.acked.push({ event, response });
	},
});

// --- ecsBatchValidateOptions -------------------------------------------------

describe("@middy/ecs-batch", () => {
	test("ecsBatchValidateOptions accepts valid config", () => {
		ecsBatchValidateOptions({
			handler: noop,
			poller: { source: "x", poll: noop, acknowledge: noop },
		});
	});

	test("ecsBatchValidateOptions requires handler and poller", () => {
		throws(() => ecsBatchValidateOptions({}), TypeError);
		throws(() => ecsBatchValidateOptions({ handler: noop }), TypeError);
	});

	test("ecsBatchValidateOptions rejects unknown property", () => {
		throws(
			() =>
				ecsBatchValidateOptions({
					handler: noop,
					poller: { source: "x", poll: noop, acknowledge: noop },
					foo: "bar",
				}),
			TypeError,
		);
	});

	// --- buildContext -----------------------------------------------------------

	test("buildContext exposes Lambda-shaped fields", () => {
		const ctx = buildContext({
			timeout: 1000,
			batchStart: Date.now(),
			awsRequestId: "abc",
			invokedFunctionArn: "arn",
		});
		strictEqual(ctx.awsRequestId, "abc");
		strictEqual(ctx.invokedFunctionArn, "arn");
		ok(ctx.getRemainingTimeInMillis() > 900);
	});

	test("buildContext clamps remaining time to zero", () => {
		const ctx = buildContext({
			timeout: 1,
			batchStart: Date.now() - 1000,
			awsRequestId: "x",
			invokedFunctionArn: undefined,
		});
		strictEqual(ctx.getRemainingTimeInMillis(), 0);
	});

	// --- ECS metadata ------------------------------------------------------------

	test("readEcsEnv reads MIDDY_ECS_* vars", () => {
		deepStrictEqual(
			readEcsEnv({
				MIDDY_ECS_ACCOUNTID: "123",
				MIDDY_ECS_REGION: "us-east-1",
				MIDDY_ECS_FAMILY: "svc",
			}),
			{ accountId: "123", region: "us-east-1", family: "svc" },
		);
	});

	test("fetchEcsMetadata returns {} when env unset", async () => {
		deepStrictEqual(await fetchEcsMetadata(undefined, async () => ({})), {});
	});

	test("fetchEcsMetadata parses task metadata", async () => {
		const fakeFetch = async () => ({
			ok: true,
			json: async () => ({
				TaskARN: "arn:aws:ecs:us-east-1:111:task/cluster/abc",
				Family: "fam",
				Revision: 7,
			}),
		});
		const meta = await fetchEcsMetadata("http://x", fakeFetch);
		strictEqual(meta.accountId, "111");
		strictEqual(meta.region, "us-east-1");
		strictEqual(meta.family, "fam");
		strictEqual(meta.revision, "7");
	});

	test("fetchEcsMetadata returns {} on fetch error", async () => {
		const fakeFetch = async () => {
			throw new Error("net");
		};
		deepStrictEqual(await fetchEcsMetadata("http://x", fakeFetch), {});
	});

	test("fetchEcsMetadata returns {} on non-ok response", async () => {
		deepStrictEqual(
			await fetchEcsMetadata("http://x", async () => ({ ok: false })),
			{},
		);
	});

	test("fetchEcsMetadata handles missing TaskARN and Revision", async () => {
		const fakeFetch = async () => ({
			ok: true,
			json: async () => ({ Family: "fam" }),
		});
		const meta = await fetchEcsMetadata("http://x", fakeFetch);
		strictEqual(meta.taskArn, undefined);
		strictEqual(meta.revision, undefined);
		strictEqual(meta.family, "fam");
	});

	// --- runPollLoop ------------------------------------------------------------

	test("runPollLoop uses contextOverride.awsRequestId when provided", async () => {
		const events = [{ Records: [1] }];
		const poller = stubPoller(events);
		let captured;
		await runPollLoop({
			poller,
			handler: async (_event, context) => {
				captured = context;
				return { batchItemFailures: [] };
			},
			timeout: 1000,
			signal: new AbortController().signal,
			contextOverride: { awsRequestId: () => "custom-id" },
		});
		strictEqual(captured.awsRequestId, "custom-id");
	});

	test("runPollLoop tolerates contextOverride without awsRequestId", async () => {
		const poller = stubPoller([{ Records: [1] }]);
		let captured;
		await runPollLoop({
			poller,
			handler: async (_e, ctx) => {
				captured = ctx;
				return { batchItemFailures: [] };
			},
			timeout: 1000,
			signal: new AbortController().signal,
			contextOverride: {},
		});
		match(captured.awsRequestId, uuidPattern);
	});

	test("runPollLoop invokes handler then acknowledge per event", async () => {
		const events = [{ Records: [1] }, { Records: [2] }];
		const poller = stubPoller(events);
		const calls = [];
		const handler = async (event) => {
			calls.push(event);
			return { batchItemFailures: [] };
		};
		const ac = new AbortController();
		await runPollLoop({
			poller,
			handler,
			timeout: 1000,
			invokedFunctionArn: "arn",
			signal: ac.signal,
		});
		deepStrictEqual(calls, events);
		strictEqual(poller.acked.length, 2);
		deepStrictEqual(poller.acked[0].response, { batchItemFailures: [] });
	});

	test("runPollLoop awsRequestId is a fresh random UUID per batch by default", async () => {
		const poller = stubPoller([{ Records: [1] }, { Records: [2] }]);
		const ids = [];
		await runPollLoop({
			poller,
			handler: async (_event, context) => {
				ids.push(context.awsRequestId);
				return { batchItemFailures: [] };
			},
			timeout: 1000,
			signal: new AbortController().signal,
		});
		strictEqual(ids.length, 2);
		match(ids[0], uuidPattern);
		match(ids[1], uuidPattern);
		notStrictEqual(ids[0], ids[1]);
	});

	test("runPollLoop uses contextOverride.awsRequestId when provided", async () => {
		const poller = stubPoller([{ Records: [1] }]);
		let n = 0;
		let captured;
		await runPollLoop({
			poller,
			handler: async (_event, context) => {
				captured = context;
				return { batchItemFailures: [] };
			},
			timeout: 1000,
			signal: new AbortController().signal,
			contextOverride: { awsRequestId: () => `id-${++n}` },
		});
		strictEqual(captured.awsRequestId, "id-1");
	});

	test("runPollLoop skips acknowledge on handler throw", async () => {
		const poller = stubPoller([{ Records: [1] }]);
		const errors = [];
		await runPollLoop({
			poller,
			handler: async () => {
				throw new Error("boom");
			},
			timeout: 1000,
			signal: new AbortController().signal,
			onError: (err, event) => errors.push({ err, event }),
		});
		strictEqual(poller.acked.length, 0);
		strictEqual(errors.length, 1);
		strictEqual(errors[0].err.message, "boom");
	});

	test("runPollLoop captures acknowledge errors via onError", async () => {
		const poller = {
			source: "test",
			async *poll() {
				yield { Records: [1] };
			},
			async acknowledge() {
				throw new Error("ack-fail");
			},
		};
		const errors = [];
		await runPollLoop({
			poller,
			handler: async () => ({ batchItemFailures: [] }),
			timeout: 1000,
			signal: new AbortController().signal,
			onError: (err) => errors.push(err),
		});
		strictEqual(errors.length, 1);
		strictEqual(errors[0].message, "ack-fail");
	});

	test("runPollLoop bails out when signal already aborted", async () => {
		const poller = stubPoller([{ Records: [1] }, { Records: [2] }]);
		const ac = new AbortController();
		ac.abort();
		let calls = 0;
		await runPollLoop({
			poller,
			handler: async () => {
				calls++;
				return { batchItemFailures: [] };
			},
			timeout: 1000,
			signal: ac.signal,
		});
		strictEqual(calls, 0);
	});

	// --- drainAndExit -----------------------------------------------------------

	test("drainAndExit aborts loop and exits 0 when loop drains in time", async () => {
		const ac = new AbortController();
		const loopPromise = new Promise((r) => setTimeout(r, 10));
		let exited;
		await drainAndExit({
			abortController: ac,
			loopPromise,
			gracefulShutdownMs: 1000,
			exitImpl: (code) => {
				exited = code;
			},
		});
		strictEqual(exited, 0);
		strictEqual(ac.signal.aborted, true);
	});

	test("drainAndExit treats rejecting loopPromise as drained", async () => {
		const ac = new AbortController();
		const loopPromise = Promise.reject(new Error("loop-died"));
		let exited;
		await drainAndExit({
			abortController: ac,
			loopPromise,
			gracefulShutdownMs: 1000,
			exitImpl: (code) => {
				exited = code;
			},
		});
		strictEqual(exited, 0);
	});

	test("drainAndExit exits 1 when deadline trips before loop drains", async () => {
		const ac = new AbortController();
		const loopPromise = new Promise((r) => setTimeout(r, 1000));
		let exited;
		await drainAndExit({
			abortController: ac,
			loopPromise,
			gracefulShutdownMs: 20,
			exitImpl: (code) => {
				exited = code;
			},
		});
		strictEqual(exited, 1);
	});

	// --- runWorker --------------------------------------------------------------

	test("runWorker drives poller and exits 0 on SIGTERM after drain", async () => {
		const events = [{ Records: [1] }];
		const poller = stubPoller(events);
		let exited;
		const { onSigterm, loopPromise } = await runWorker(
			{
				handler: async () => ({ batchItemFailures: [] }),
				poller,
				timeout: 1000,
				gracefulShutdownMs: 1000,
			},
			{ exit: (code) => (exited = code) },
		);
		await loopPromise;
		process.removeListener("SIGTERM", onSigterm);
		await onSigterm();
		strictEqual(exited, 0);
		strictEqual(poller.acked.length, 1);
	});

	test("runWorker composes invokedFunctionArn from MIDDY_ECS_* env", async () => {
		process.env.MIDDY_ECS_ACCOUNTID = "999";
		process.env.MIDDY_ECS_REGION = "us-west-2";
		process.env.MIDDY_ECS_FAMILY = "svc";
		let captured;
		const poller = stubPoller([{ Records: [1] }]);
		const { onSigterm, loopPromise } = await runWorker(
			{
				handler: async (_e, ctx) => {
					captured = ctx;
					return { batchItemFailures: [] };
				},
				poller,
				timeout: 1000,
				gracefulShutdownMs: 1000,
			},
			{ exit: noop },
		);
		await loopPromise;
		strictEqual(
			captured.invokedFunctionArn,
			"arn:aws:ecs:us-west-2:999:service/svc",
		);
		process.removeListener("SIGTERM", onSigterm);
		delete process.env.MIDDY_ECS_ACCOUNTID;
		delete process.env.MIDDY_ECS_REGION;
		delete process.env.MIDDY_ECS_FAMILY;
	});

	// --- runPrimary -------------------------------------------------------------

	test("runPrimary forks workers and registers SIGTERM forwarder", async () => {
		let forks = 0;
		const fakeCluster = {
			isPrimary: true,
			workers: { 1: { process: { kill: noop } } },
			fork: () => forks++,
			on: noop,
		};
		const fakeFetch = async () => ({
			ok: true,
			json: async () => ({
				TaskARN: "arn:aws:ecs:us-east-1:222:task/c/abc",
				Family: "fam",
				Revision: 1,
			}),
		});
		process.env.ECS_CONTAINER_METADATA_URI_V4 = "http://meta";
		const { onSigterm } = await runPrimary(
			{ workers: 3 },
			{ cluster: fakeCluster, fetch: fakeFetch },
		);
		strictEqual(forks, 3);
		strictEqual(process.env.MIDDY_ECS_ACCOUNTID, "222");
		onSigterm();
		process.removeListener("SIGTERM", onSigterm);
		delete process.env.ECS_CONTAINER_METADATA_URI_V4;
		delete process.env.MIDDY_ECS_ACCOUNTID;
		delete process.env.MIDDY_ECS_REGION;
		delete process.env.MIDDY_ECS_TASKARN;
		delete process.env.MIDDY_ECS_FAMILY;
		delete process.env.MIDDY_ECS_REVISION;
	});

	// Minimal node:cluster stand-in. `crash(id)` mirrors the primary's bookkeeping:
	// the worker leaves cluster.workers before the last of its exit/disconnect
	// events fires (order between the two is not guaranteed by Node).
	const makeFakeCluster = () => {
		const handlers = {};
		const killed = [];
		let nextId = 1;
		const cluster = {
			isPrimary: true,
			workers: {},
			forks: 0,
			killed,
			fork() {
				const id = nextId++;
				const worker = {
					id,
					process: { kill: (signal) => killed.push([id, signal]) },
				};
				cluster.workers = { ...cluster.workers, [id]: worker };
				cluster.forks++;
				return worker;
			},
			on(ev, fn) {
				handlers[ev] = fn;
			},
			emit(ev, id, ...args) {
				handlers[ev]?.(cluster.workers[id], ...args);
			},
			remove(id) {
				const { [id]: _gone, ...rest } = cluster.workers;
				cluster.workers = rest;
			},
			// node:cluster's exit event: (worker, code, signal); code is null when
			// a signal killed the worker.
			exit(id, code, signal = null) {
				cluster.remove(id);
				handlers.exit(undefined, code, signal);
			},
			crash(id) {
				cluster.exit(id, 1);
			},
		};
		return cluster;
	};

	const noMeta = async () => ({ ok: false });

	test("runPrimary re-forks a crashed worker after a backoff that doubles up to 30 s", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const { onSigterm } = await runPrimary(
			{ workers: 1 },
			{ cluster, fetch: noMeta },
		);
		process.removeListener("SIGTERM", onSigterm);
		strictEqual(cluster.forks, 1);
		for (const delayMs of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
			const before = cluster.forks;
			cluster.crash(before);
			t.mock.timers.tick(delayMs - 1);
			strictEqual(cluster.forks, before, `no re-fork before ${delayMs}ms`);
			t.mock.timers.tick(1);
			strictEqual(cluster.forks, before + 1, `re-fork at ${delayMs}ms`);
		}
	});

	test("runPrimary resets the re-fork backoff after 60 s without a worker exit", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const { onSigterm } = await runPrimary(
			{ workers: 1 },
			{ cluster, fetch: noMeta },
		);
		process.removeListener("SIGTERM", onSigterm);
		cluster.crash(1);
		t.mock.timers.tick(1000);
		cluster.crash(2);
		t.mock.timers.tick(2000);
		strictEqual(cluster.forks, 3);
		// Worker 3 stays healthy for a minute, so the next crash starts over at 1 s.
		t.mock.timers.tick(60_000);
		cluster.crash(3);
		t.mock.timers.tick(999);
		strictEqual(cluster.forks, 3);
		t.mock.timers.tick(1);
		strictEqual(cluster.forks, 4);
	});

	test("runPrimary SIGTERM signals workers, stops re-forking and exits once all are gone", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 2 },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		onSigterm();
		deepStrictEqual(cluster.killed, [
			[1, "SIGTERM"],
			[2, "SIGTERM"],
		]);
		deepStrictEqual(exits, []);
		cluster.exit(1, 0);
		t.mock.timers.tick(60_000);
		strictEqual(cluster.forks, 2, "drained worker is not replaced");
		deepStrictEqual(exits, []);
		cluster.exit(2, 0);
		deepStrictEqual(exits, [0]);
		t.mock.timers.tick(60_000);
		strictEqual(cluster.forks, 2);
		deepStrictEqual(exits, [0], "primary exits exactly once");
	});

	test("runPrimary exits with the highest exit code a worker reported during the drain", async () => {
		// A worker that hit its drain deadline or whose poller failed exits 1; the
		// task must not report success to ECS when that happened.
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 3 },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		onSigterm();
		cluster.exit(1, 2);
		deepStrictEqual(exits, []);
		cluster.exit(2, 1);
		deepStrictEqual(exits, []);
		cluster.exit(3, 0);
		deepStrictEqual(exits, [2]);
	});

	test("runPrimary treats a signal-killed worker as a failed exit", async () => {
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 1 },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		onSigterm();
		cluster.exit(1, null, "SIGKILL");
		deepStrictEqual(exits, [1]);
	});

	test("runPrimary ignores a worker crash before SIGTERM when computing its exit code", async (t) => {
		// A worker that crashed hours earlier was replaced; only the drain decides
		// whether the task reports success to ECS.
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 2 },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		cluster.crash(1);
		t.mock.timers.tick(1000);
		strictEqual(cluster.forks, 3, "crashed worker is replaced");
		deepStrictEqual(exits, []);
		onSigterm();
		deepStrictEqual(cluster.killed, [
			[2, "SIGTERM"],
			[3, "SIGTERM"],
		]);
		cluster.exit(2, 0);
		cluster.exit(3, 0);
		deepStrictEqual(exits, [0]);
	});

	test("runPrimary SIGTERM during a re-fork backoff exits at once and drops the pending fork", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 1 },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		cluster.crash(1);
		onSigterm();
		deepStrictEqual(cluster.killed, []);
		// The crash happened before the drain, so it does not taint the exit code.
		deepStrictEqual(exits, [0]);
		t.mock.timers.tick(1000);
		strictEqual(cluster.forks, 1, "pending re-fork is cancelled");
	});

	test("runPrimary exits after the last worker's disconnect when it fires after exit", async () => {
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 1 },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		onSigterm();
		// exit fires first while the worker is still listed; node:cluster removes
		// it before emitting the trailing disconnect.
		cluster.emit("exit", 1, 0);
		deepStrictEqual(exits, []);
		cluster.remove(1);
		cluster.emit("disconnect", 1);
		deepStrictEqual(exits, [0]);
	});

	test("runPrimary ignores worker disconnects while running", async () => {
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 1 },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		cluster.remove(1);
		cluster.emit("disconnect", 1);
		deepStrictEqual(exits, []);
	});

	// --- ecsBatchRunner dispatch -----------------------------------------------

	test("ecsBatchRunner dispatches to runPrimary when cluster.isPrimary", async () => {
		const fakeCluster = { isPrimary: true, workers: {}, fork: noop, on: noop };
		const { onSigterm } = await ecsBatchRunner(
			{ handler: noop, poller: stubPoller(), workers: 1 },
			{ cluster: fakeCluster, fetch: async () => ({ ok: false }) },
		);
		process.removeListener("SIGTERM", onSigterm);
	});

	test("ecsBatchRunner dispatches to runWorker when not primary", async () => {
		const fakeCluster = { isPrimary: false };
		const { onSigterm, loopPromise } = await ecsBatchRunner(
			{
				handler: async () => ({ batchItemFailures: [] }),
				poller: stubPoller([{ Records: [1] }]),
				workers: 1,
			},
			{ cluster: fakeCluster, exit: noop },
		);
		await loopPromise;
		process.removeListener("SIGTERM", onSigterm);
	});

	test("ecsBatchRunner rejects invalid options", async () => {
		await rejects(ecsBatchRunner({}), TypeError);
	});

	const countForks = async (poller, extra = {}) => {
		let forks = 0;
		const fakeCluster = {
			isPrimary: true,
			workers: {},
			fork: () => {
				forks += 1;
			},
			on: noop,
		};
		const { onSigterm } = await ecsBatchRunner(
			{ handler: async () => ({ batchItemFailures: [] }), poller, ...extra },
			{ cluster: fakeCluster, fetch: async () => ({ ok: false }) },
		);
		process.removeListener("SIGTERM", onSigterm);
		return forks;
	};

	test("ecsBatchRunner default workers fallback uses availableParallelism", async () => {
		strictEqual(await countForks(stubPoller()), availableParallelism());
	});

	// Every worker runs its own poller, and the Kinesis and DynamoDB Streams
	// pollers have no shard coordination: N workers read every shard N times.
	for (const source of ["aws:kinesis", "aws:dynamodb"]) {
		test(`ecsBatchRunner defaults workers to 1 for ${source}`, async () => {
			strictEqual(await countForks({ ...stubPoller(), source }), 1);
		});

		test(`ecsBatchRunner accepts workers: 1 for ${source}`, async () => {
			strictEqual(
				await countForks({ ...stubPoller(), source }, { workers: 1 }),
				1,
			);
		});

		test(`ecsBatchRunner rejects workers > 1 for ${source}`, async () => {
			await rejects(
				ecsBatchRunner(
					{ handler: noop, poller: { ...stubPoller(), source }, workers: 2 },
					{ cluster: { isPrimary: true } },
				),
				(err) => {
					strictEqual(
						err.message,
						`workers must be 1 for ${source}: every worker would read every shard`,
					);
					deepStrictEqual(err.cause, {
						package: "@middy/ecs-batch",
						data: { source, workers: 2 },
					});
					return true;
				},
			);
		});
	}

	test("runWorker uses default abortController when none injected", async () => {
		const poller = stubPoller([{ Records: [1] }]);
		const { onSigterm, loopPromise, abortController } = await runWorker(
			{
				handler: async () => ({ batchItemFailures: [] }),
				poller,
				timeout: 1000,
				gracefulShutdownMs: 1000,
			},
			{ exit: noop },
		);
		await loopPromise;
		ok(abortController instanceof AbortController);
		process.removeListener("SIGTERM", onSigterm);
	});

	// --- pollSqs ----------------------------------------------------------------

	test("pollSqsValidateOptions requires queueUrl", () => {
		throws(() => pollSqsValidateOptions({}), TypeError);
	});

	test("pollSqs uses default SQSClient when none injected", () => {
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
		});
		strictEqual(poller.source, "aws:sqs");
		ok(poller.client);
	});

	test("pollSqs handles message with missing Body/Attributes/MessageAttributes", async () => {
		const ac = new AbortController();
		const client = {
			send: async () => {
				ac.abort();
				return { Messages: [{ MessageId: "m", ReceiptHandle: "r" }] };
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
			client,
		});
		const it = poller.poll(ac.signal);
		const { value } = await it.next();
		strictEqual(value.Records[0].body, "");
		deepStrictEqual(value.Records[0].attributes, {});
		deepStrictEqual(value.Records[0].messageAttributes, {});
	});

	test("pollSqs poll handles missing res.Messages", async () => {
		const ac = new AbortController();
		let calls = 0;
		const client = {
			send: async () => {
				calls++;
				if (calls >= 2) ac.abort();
				return {};
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
	});

	test("pollSqs.acknowledge tolerates response without batchItemFailures", async () => {
		const sent = [];
		const client = {
			send: async (cmd) => {
				sent.push(cmd);
				return {};
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
			client,
		});
		const event = { Records: [{ messageId: "m1", receiptHandle: "rh1" }] };
		await poller.acknowledge(event, undefined);
		await poller.acknowledge(event, {});
		// Both calls treat all records as successful, so 2 deletes total.
		strictEqual(sent.length, 2);
	});

	test("pollSqs.acknowledge tolerates event without Records", async () => {
		const client = {
			sent: [],
			send: async (cmd) => {
				client.sent.push(cmd);
				return {};
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
			client,
		});
		await poller.acknowledge({}, { batchItemFailures: [] });
		strictEqual(client.sent.length, 0);
	});

	test("pollSqs yields aws:sqs Records[] events from ReceiveMessage", async () => {
		const client = makeFakeSqsClient([
			{
				Messages: [
					{
						MessageId: "m1",
						ReceiptHandle: "rh1",
						Body: "hello",
						Attributes: { SentTimestamp: "1" },
						MessageAttributes: {},
					},
				],
			},
			{ Messages: [] },
		]);
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/111/queue",
			client,
		});
		strictEqual(poller.source, "aws:sqs");
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { value, done } = await it.next();
		strictEqual(done, false);
		strictEqual(value.Records.length, 1);
		strictEqual(value.Records[0].messageId, "m1");
		strictEqual(value.Records[0].body, "hello");
		strictEqual(value.Records[0].eventSource, "aws:sqs");
		strictEqual(
			value.Records[0].eventSourceARN,
			"arn:aws:sqs:us-east-1:111:queue",
		);
		strictEqual(value.Records[0].awsRegion, "us-east-1");
		ac.abort();
		await it.return?.();
	});

	test("pollSqs.acknowledge deletes records not in batchItemFailures", async () => {
		const sent = [];
		const client = {
			sent,
			send: async (cmd) => {
				sent.push(cmd);
				return {};
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/111/q",
			client,
		});
		const event = {
			Records: [
				{ messageId: "m1", receiptHandle: "rh1" },
				{ messageId: "m2", receiptHandle: "rh2" },
				{ messageId: "m3", receiptHandle: "rh3" },
			],
		};
		await poller.acknowledge(event, {
			batchItemFailures: [{ itemIdentifier: "m2" }],
		});
		strictEqual(sent.length, 1);
		const entries = sent[0].input.Entries;
		strictEqual(entries.length, 2);
		deepStrictEqual(
			entries.map((e) => e.ReceiptHandle),
			["rh1", "rh3"],
		);
	});

	test("pollSqs.acknowledge no-ops when nothing to delete", async () => {
		const client = {
			sent: [],
			send: async (cmd) => {
				client.sent.push(cmd);
				return {};
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/111/q",
			client,
		});
		const event = { Records: [{ messageId: "m1", receiptHandle: "rh1" }] };
		await poller.acknowledge(event, {
			batchItemFailures: [{ itemIdentifier: "m1" }],
		});
		strictEqual(client.sent.length, 0);
	});

	test("pollSqs.acknowledge chunks deletes to batches of 10", async () => {
		const client = {
			sent: [],
			send: async (cmd) => {
				client.sent.push(cmd);
				return {};
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/111/q",
			client,
		});
		const Records = Array.from({ length: 23 }, (_, i) => ({
			messageId: `m${i}`,
			receiptHandle: `rh${i}`,
		}));
		await poller.acknowledge({ Records }, { batchItemFailures: [] });
		strictEqual(client.sent.length, 3);
		strictEqual(client.sent[0].input.Entries.length, 10);
		strictEqual(client.sent[1].input.Entries.length, 10);
		strictEqual(client.sent[2].input.Entries.length, 3);
	});

	test("pollSqs poll exits cleanly when signal aborts mid-receive", async () => {
		const ac = new AbortController();
		const client = {
			send: async () => {
				ac.abort();
				const err = new Error("aborted");
				err.name = "AbortError";
				throw err;
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/111/q",
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
	});

	// --- pollKinesis ------------------------------------------------------------

	test("pollKinesis yields aws:kinesis Records[] from GetRecords", async () => {
		const client = {
			send: async (cmd) => {
				const name = cmd.constructor.name;
				if (name === "GetShardIteratorCommand") {
					return { ShardIterator: "ITER1" };
				}
				if (name === "GetRecordsCommand") {
					return {
						NextShardIterator: null,
						Records: [
							{
								PartitionKey: "p1",
								SequenceNumber: "seq-1",
								Data: Buffer.from("data1"),
								ApproximateArrivalTimestamp: new Date(1_700_000_000_000),
							},
						],
					};
				}
			},
		};
		const poller = pollKinesis({
			streamName: "stream",
			shardId: "shard-0",
			streamArn: "arn:aws:kinesis:us-east-1:111:stream/stream",
			awsRegion: "us-east-1",
			client,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { value } = await it.next();
		strictEqual(value.Records[0].kinesis.sequenceNumber, "seq-1");
		strictEqual(value.Records[0].kinesis.partitionKey, "p1");
		strictEqual(
			value.Records[0].kinesis.data,
			Buffer.from("data1").toString("base64"),
		);
		strictEqual(value.Records[0].eventSource, "aws:kinesis");
		strictEqual(
			value.Records[0].eventSourceARN,
			"arn:aws:kinesis:us-east-1:111:stream/stream",
		);
		await poller.acknowledge(value, {});
		// NextShardIterator null: the shard is closed.
		await rejects(it.next(), { name: "SourceClosedError" });
	});

	test("pollDynamoDBStreams.acknowledge tolerates an event without Records", async () => {
		const poller = pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			client: { send: async () => ({}) },
		});
		await poller.acknowledge({}, { batchItemFailures: [] });
	});

	test("pollDynamoDBStreams pollingDelay=0 skips delay between empty GetRecords", async () => {
		let calls = 0;
		const ac = new AbortController();
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				calls++;
				if (calls >= 3) ac.abort();
				return { NextShardIterator: "i", Records: [] };
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			pollingDelay: 0,
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
		ok(calls >= 3);
	});

	test("pollDynamoDBStreams maps multiple records in one batch", async () => {
		const ac = new AbortController();
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				ac.abort();
				return {
					NextShardIterator: null,
					Records: [
						{
							eventID: "e1",
							eventName: "INSERT",
							eventVersion: "1.1",
							dynamodb: { SequenceNumber: "1" },
						},
						{
							eventID: "e2",
							eventName: "MODIFY",
							eventVersion: "1.1",
							dynamodb: { SequenceNumber: "2" },
						},
						{
							eventID: "e3",
							eventName: "REMOVE",
							eventVersion: "1.1",
							dynamodb: { SequenceNumber: "3" },
						},
					],
				};
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			client,
		});
		const it = poller.poll(ac.signal);
		const { value } = await it.next();
		strictEqual(value.Records.length, 3);
		strictEqual(value.Records[1].eventName, "MODIFY");
		// Resume past the yield to exercise the post-yield path: NextShardIterator
		// was null so the while loop exits naturally on the next iteration.
		const last = await it.next();
		strictEqual(last.done, true);
	});

	test("pollDynamoDBStreams record without eventVersion gets default 1.1", async () => {
		const ac = new AbortController();
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				ac.abort();
				return {
					NextShardIterator: null,
					Records: [
						{
							eventID: "e",
							eventName: "INSERT",
							dynamodb: { SequenceNumber: "1" },
						},
					],
				};
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			client,
		});
		const it = poller.poll(ac.signal);
		const { value } = await it.next();
		strictEqual(value.Records[0].eventVersion, "1.1");
	});

	test("pollDynamoDBStreams handles missing res.Records", async () => {
		const ac = new AbortController();
		let calls = 0;
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				calls++;
				if (calls >= 2) ac.abort();
				return { NextShardIterator: "i" };
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			pollingDelay: 1,
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
	});

	test("pollKinesis.acknowledge tolerates an event without Records", async () => {
		const poller = pollKinesis({
			streamName: "s",
			shardId: "0",
			client: { send: async () => ({}) },
		});
		await poller.acknowledge({}, { batchItemFailures: [] });
	});

	// --- pollDynamoDBStreams ----------------------------------------------------

	test("pollDynamoDBStreams yields aws:dynamodb Records[]", async () => {
		const client = {
			send: async (cmd) => {
				const name = cmd.constructor.name;
				if (name === "GetShardIteratorCommand") {
					return { ShardIterator: "ITER1" };
				}
				return {
					NextShardIterator: null,
					Records: [
						{
							eventID: "e1",
							eventName: "INSERT",
							eventVersion: "1.1",
							dynamodb: { SequenceNumber: "100" },
						},
					],
				};
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn: "arn:aws:dynamodb:us-east-1:111:table/t/stream/2024",
			shardId: "shard-0",
			awsRegion: "us-east-1",
			client,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { value } = await it.next();
		strictEqual(value.Records[0].eventSource, "aws:dynamodb");
		strictEqual(value.Records[0].eventName, "INSERT");
		strictEqual(value.Records[0].dynamodb.SequenceNumber, "100");
	});

	// --- additional coverage: pollSqs --------------------------------------------

	test("pollSqs validator rejects unknown property", () => {
		throws(
			() =>
				pollSqsValidateOptions({
					queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
					foo: "bar",
				}),
			TypeError,
		);
	});

	test("pollSqs derives no eventSourceARN from malformed queueUrl", async () => {
		const client = {
			sent: [],
			send: async () => ({
				Messages: [{ MessageId: "m", ReceiptHandle: "r", Body: "" }],
			}),
		};
		const poller = pollSqs({ queueUrl: "not-a-url", client });
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { value } = await it.next();
		strictEqual(value.Records[0].eventSourceARN, undefined);
		strictEqual(value.Records[0].awsRegion, undefined);
		ac.abort();
		await it.return?.();
	});

	test("pollSqs derives no eventSourceARN when queueUrl path is incomplete", async () => {
		const client = {
			send: async () => ({
				Messages: [{ MessageId: "m", ReceiptHandle: "r", Body: "" }],
			}),
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/",
			client,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { value } = await it.next();
		strictEqual(value.Records[0].eventSourceARN, undefined);
		ac.abort();
		await it.return?.();
	});

	test("pollSqs forwards visibilityTimeout option", async () => {
		const sent = [];
		const ac = new AbortController();
		const client = {
			send: async (cmd) => {
				sent.push(cmd);
				ac.abort();
				return { Messages: [] };
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
			visibilityTimeout: 30,
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
		strictEqual(sent[0].input.VisibilityTimeout, 30);
	});

	// A message not deleted before its visibility timeout expires is received
	// again, and deleting it later with the earlier receipt handle fails. The
	// queue default is 30 s, below the runner's 60 s default timeout.
	// https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
	// https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ReceiveMessage.html
	const firstReceiveInput = async (options, pollOptions) => {
		const sent = [];
		const ac = new AbortController();
		const client = {
			send: async (cmd) => {
				sent.push(cmd);
				ac.abort();
				return { Messages: [] };
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
			client,
			...options,
		});
		await poller.poll(ac.signal, noop, pollOptions).next();
		return sent[0].input;
	};

	test("pollSqs defaults VisibilityTimeout to cover the runner timeout plus acknowledge headroom", async () => {
		strictEqual(
			(await firstReceiveInput({}, { timeout: 60_000 })).VisibilityTimeout,
			90,
		);
		strictEqual(
			(await firstReceiveInput({}, { timeout: 60_001 })).VisibilityTimeout,
			91,
		);
	});

	test("pollSqs keeps an explicit visibilityTimeout over the runner timeout", async () => {
		strictEqual(
			(await firstReceiveInput({ visibilityTimeout: 600 }, { timeout: 60_000 }))
				.VisibilityTimeout,
			600,
		);
	});

	test("pollSqs leaves VisibilityTimeout to the queue without a timeout or option", async () => {
		strictEqual(
			"VisibilityTimeout" in (await firstReceiveInput({}, undefined)),
			false,
		);
		strictEqual(
			"VisibilityTimeout" in (await firstReceiveInput({}, {})),
			false,
		);
	});

	test("pollSqs exposes its configured visibilityTimeout", () => {
		const queueUrl = "https://sqs.us-east-1.amazonaws.com/1/q";
		strictEqual(
			pollSqs({ queueUrl, client: {}, visibilityTimeout: 45 })
				.visibilityTimeout,
			45,
		);
		strictEqual(pollSqs({ queueUrl, client: {} }).visibilityTimeout, undefined);
	});

	test("runPollLoop passes the runner timeout to the poller", async () => {
		const seen = [];
		const poller = {
			source: "test",
			poll(_signal, _onError, options) {
				seen.push(options);
				return [];
			},
			acknowledge: noop,
		};
		await runPollLoop({
			poller,
			handler: noop,
			timeout: 1234,
			signal: new AbortController().signal,
		});
		deepStrictEqual(seen, [{ timeout: 1234 }]);
	});

	test("ecsBatchRunner rejects an SQS visibilityTimeout that does not outlast the timeout", async () => {
		const queueUrl = "https://sqs.us-east-1.amazonaws.com/1/q";
		for (const [visibilityTimeout, timeout] of [
			[60, undefined],
			[0, undefined],
			[10, 10_000],
		]) {
			await rejects(
				ecsBatchRunner(
					{
						handler: noop,
						poller: pollSqs({ queueUrl, client: {}, visibilityTimeout }),
						...(timeout === undefined ? {} : { timeout }),
						workers: 1,
					},
					{ cluster: { isPrimary: true } },
				),
				(err) => {
					strictEqual(
						err.message,
						"visibilityTimeout must outlast timeout: messages would be received again mid-batch",
					);
					deepStrictEqual(err.cause, {
						package: "@middy/ecs-batch",
						data: { visibilityTimeout, timeout: timeout ?? 60_000 },
					});
					return true;
				},
			);
		}
	});

	test("ecsBatchRunner accepts an SQS visibilityTimeout that outlasts the timeout, or none", async () => {
		const queueUrl = "https://sqs.us-east-1.amazonaws.com/1/q";
		for (const visibilityTimeout of [61, undefined]) {
			strictEqual(
				await countForks(pollSqs({ queueUrl, client: {}, visibilityTimeout }), {
					workers: 1,
				}),
				1,
			);
		}
		strictEqual(
			await countForks(
				pollSqs({ queueUrl, client: {}, visibilityTimeout: 11 }),
				{ workers: 1, timeout: 10_000 },
			),
			1,
		);
	});

	test("pollSqs poll rethrows non-abort errors", async () => {
		const client = {
			send: async () => {
				throw new Error("bad creds");
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
			client,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		await rejects(() => it.next(), /bad creds/);
	});

	test("pollSqs poll iterates naturally back to while-test after a yield", async () => {
		const ac = new AbortController();
		let calls = 0;
		const client = {
			send: async () => {
				calls++;
				if (calls === 1) {
					return {
						Messages: [{ MessageId: "m1", ReceiptHandle: "rh1", Body: "" }],
					};
				}
				ac.abort();
				return { Messages: [] };
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
			client,
		});
		const it = poller.poll(ac.signal);
		const first = await it.next();
		strictEqual(first.done, false);
		const second = await it.next();
		strictEqual(second.done, true);
		strictEqual(calls, 2);
	});

	test("pollSqs poll handles empty Messages and continues until aborted", async () => {
		let calls = 0;
		const ac = new AbortController();
		const client = {
			send: async () => {
				calls++;
				if (calls >= 2) ac.abort();
				return { Messages: [] };
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
		ok(calls >= 2);
	});

	// --- additional coverage: pollKinesis ---------------------------------------

	test("pollKinesis uses default KinesisClient when none injected", () => {
		const poller = pollKinesis({ streamName: "s", shardId: "0" });
		strictEqual(poller.source, "aws:kinesis");
		ok(poller.client);
	});

	test("pollKinesis validator requires streamName + shardId", () => {
		throws(() => pollKinesisValidateOptions({}), TypeError);
		throws(() => pollKinesisValidateOptions({ streamName: "s" }), TypeError);
	});

	test("pollKinesis encodes Uint8Array data and string data", async () => {
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return {
					NextShardIterator: null,
					Records: [
						{
							PartitionKey: "p",
							SequenceNumber: "1",
							Data: new Uint8Array([1, 2, 3]),
						},
						{ PartitionKey: "p", SequenceNumber: "2", Data: "literal-string" },
						{ PartitionKey: "p", SequenceNumber: "3", Data: 42 },
						{ PartitionKey: "p", SequenceNumber: "4", Data: null },
					],
				};
			},
		};
		const poller = pollKinesis({ streamName: "s", shardId: "0", client });
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { value } = await it.next();
		strictEqual(
			value.Records[0].kinesis.data,
			Buffer.from([1, 2, 3]).toString("base64"),
		);
		strictEqual(value.Records[1].kinesis.data, "literal-string");
		strictEqual(
			value.Records[2].kinesis.data,
			Buffer.from("42").toString("base64"),
		);
		strictEqual(value.Records[3].kinesis.data, "");
	});

	test("pollKinesis aborts cleanly during GetShardIterator", async () => {
		const ac = new AbortController();
		const client = {
			send: async () => {
				ac.abort();
				const e = new Error("aborted");
				e.name = "AbortError";
				throw e;
			},
		};
		const poller = pollKinesis({ streamName: "s", shardId: "0", client });
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
	});

	test("pollKinesis aborts cleanly during GetRecords", async () => {
		const ac = new AbortController();
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				ac.abort();
				const e = new Error("aborted");
				e.name = "AbortError";
				throw e;
			},
		};
		const poller = pollKinesis({ streamName: "s", shardId: "0", client });
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
	});

	test("pollKinesis pollingDelay=0 skips delay between empty GetRecords", async () => {
		let calls = 0;
		const ac = new AbortController();
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				calls++;
				if (calls >= 3) ac.abort();
				return { NextShardIterator: "i", Records: [] };
			},
		};
		const poller = pollKinesis({
			streamName: "s",
			shardId: "0",
			pollingDelay: 0,
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
		ok(calls >= 3);
	});

	test("pollKinesis handles missing res.Records", async () => {
		const ac = new AbortController();
		let calls = 0;
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				calls++;
				if (calls >= 2) ac.abort();
				return { NextShardIterator: "i" };
			},
		};
		const poller = pollKinesis({
			streamName: "s",
			shardId: "0",
			pollingDelay: 1,
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
	});

	test("pollKinesis exits when shardIterator becomes null", async () => {
		const ac = new AbortController();
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: null };
				}
				return { NextShardIterator: null, Records: [] };
			},
		};
		const poller = pollKinesis({ streamName: "s", shardId: "0", client });
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
	});

	test("pollKinesis poll loops with pollingDelay when no records, then aborts", async () => {
		let calls = 0;
		const ac = new AbortController();
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				calls++;
				if (calls >= 2) ac.abort();
				return { NextShardIterator: "i", Records: [] };
			},
		};
		const poller = pollKinesis({
			streamName: "s",
			shardId: "0",
			pollingDelay: 5,
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
		ok(calls >= 2);
	});

	test("pollKinesis poll rethrows non-abort errors from GetShardIterator", async () => {
		const client = {
			send: async () => {
				throw new Error("iam-denied");
			},
		};
		const poller = pollKinesis({ streamName: "s", shardId: "0", client });
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		await rejects(() => it.next(), /iam-denied/);
	});

	test("pollKinesis poll rethrows non-abort errors from GetRecords", async () => {
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				throw new Error("provisioned-throughput-exceeded");
			},
		};
		const poller = pollKinesis({ streamName: "s", shardId: "0", client });
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		await rejects(() => it.next(), /provisioned-throughput-exceeded/);
	});

	// --- additional coverage: pollDynamoDBStreams -------------------------------

	test("pollDynamoDBStreams uses default DynamoDBStreamsClient when none injected", () => {
		const poller = pollDynamoDBStreams({ streamArn: "arn", shardId: "0" });
		strictEqual(poller.source, "aws:dynamodb");
		ok(poller.client);
	});

	test("pollDynamoDBStreams validator requires streamArn + shardId", () => {
		throws(() => pollDynamoDBStreamsValidateOptions({}), TypeError);
	});

	test("pollDynamoDBStreams aborts cleanly during GetShardIterator", async () => {
		const ac = new AbortController();
		const client = {
			send: async () => {
				ac.abort();
				const e = new Error("aborted");
				e.name = "AbortError";
				throw e;
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
	});

	test("pollDynamoDBStreams aborts cleanly during GetRecords", async () => {
		const ac = new AbortController();
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				ac.abort();
				const e = new Error("aborted");
				e.name = "AbortError";
				throw e;
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
	});

	test("pollDynamoDBStreams loops with pollingDelay when no records", async () => {
		let calls = 0;
		const ac = new AbortController();
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				calls++;
				if (calls >= 2) ac.abort();
				return { NextShardIterator: "i", Records: [] };
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			pollingDelay: 5,
			client,
		});
		const it = poller.poll(ac.signal);
		const r = await it.next();
		strictEqual(r.done, true);
		ok(calls >= 2);
	});

	test("pollDynamoDBStreams rethrows non-abort errors from GetShardIterator", async () => {
		const client = {
			send: async () => {
				throw new Error("access-denied");
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			client,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		await rejects(() => it.next(), /access-denied/);
	});

	test("pollDynamoDBStreams rethrows non-abort errors from GetRecords", async () => {
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				throw new Error("expired");
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn: "arn",
			shardId: "0",
			client,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		await rejects(() => it.next(), /expired/);
	});

	// --- pollKafka --------------------------------------------------------------

	test("pollKafka validator requires brokers + groupId + topics", () => {
		throws(() => pollKafkaValidateOptions({}), TypeError);
	});

	const makeFakeKafkaConsumer = () => {
		const subscriptions = [];
		const listeners = [];
		let runConfig;
		return {
			subscriptions,
			listeners,
			connectCalled: 0,
			disconnectCalled: 0,
			// kafkajs instrumentation events: consumer.on(consumer.events.CRASH, fn)
			// hands the listener { id, type, timestamp, payload }.
			events: { CRASH: "consumer.crash" },
			runHandler: () => runConfig.eachBatch,
			runConfig: () => runConfig,
			emit(type, payload) {
				for (const [name, fn] of listeners) {
					if (name === type) fn({ id: "1", type, timestamp: 0, payload });
				}
			},
			on(name, fn) {
				listeners.push([name, fn]);
				return () => {};
			},
			async connect() {
				this.connectCalled++;
			},
			async disconnect() {
				this.disconnectCalled++;
			},
			async subscribe(spec) {
				subscriptions.push(spec);
			},
			run(config) {
				runConfig = config;
			},
		};
	};

	// Builds the eachBatch payload kafkajs hands over, recording every call so a
	// test can assert what was resolved, committed and heartbeated.
	const makeKafkaBatchPayload = (batch, uncommitted = { topics: [] }) => {
		const calls = { resolved: [], commits: [], heartbeats: 0 };
		return {
			calls,
			payload: {
				batch,
				resolveOffset: (o) => calls.resolved.push(o),
				commitOffsetsIfNecessary: async (offsets) => {
					calls.commits.push(offsets);
				},
				uncommittedOffsets: () => uncommitted,
				heartbeat: async () => {
					calls.heartbeats++;
				},
			},
		};
	};

	const kafkaBatchOf = (...offsets) => ({
		topic: "t1",
		partition: 0,
		messages: offsets.map((offset) => ({
			offset,
			timestamp: "1700000000000",
			key: null,
			value: Buffer.from(`v${offset}`),
		})),
	});

	const drainKafkaSetup = async (it) => {
		// Start the generator so it runs through connect/subscribe/consumer.run
		// and parks at waitForEvent. We BOX the firstNext promise so the outer
		// async fn does not unwrap it (returning a bare promise would chain it,
		// blocking the caller until the generator actually yields).
		const firstNext = it.next();
		for (let i = 0; i < 5; i++) await Promise.resolve();
		return { firstNext };
	};

	test("pollKafka yields aws:kafka event from eachBatch and commits offsets on ack", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			retryDelayMs: 0,
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
			eventSourceArn: "arn:aws:kafka:...",
		});
		strictEqual(poller.source, "aws:kafka");
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);

		// Drive one batch via eachBatch. kafkajs only commits inside eachBatch when
		// handed explicit offsets; a bare commitOffsetsIfNecessary() is a no-op
		// with autoCommit: false.
		const uncommitted = {
			topics: [{ topic: "t1", partitions: [{ partition: 0, offset: "11" }] }],
		};
		const { calls, payload } = makeKafkaBatchPayload(
			{
				topic: "t1",
				partition: 0,
				messages: [
					{
						offset: "10",
						timestamp: "1700000000000",
						key: Buffer.from("k1"),
						value: Buffer.from("v1"),
						headers: { h1: Buffer.from("hv") },
					},
					{
						offset: "11",
						timestamp: "1700000000001",
						key: null,
						value: null,
					},
				],
			},
			uncommitted,
		);
		const fn = consumer.runHandler();
		const eachBatchPromise = fn(payload);

		const { value } = await firstNext;
		strictEqual(value.eventSource, "aws:kafka");
		const records = value.records["t1-0"];
		strictEqual(records.length, 2);
		strictEqual(records[0].topic, "t1");
		strictEqual(records[0].key, Buffer.from("k1").toString("base64"));
		deepStrictEqual(records[0].headers, [{ h1: [104, 118] }]);
		strictEqual(records[1].key, null);
		deepStrictEqual(records[1].headers, []);

		await poller.acknowledge(value, {
			batchItemFailures: [{ itemIdentifier: "t1-0-11" }],
		});
		await eachBatchPromise;

		deepStrictEqual(calls.resolved, ["10"]); // stops at first failure
		deepStrictEqual(calls.commits, [uncommitted]);
		strictEqual(calls.heartbeats, 1);
		strictEqual(consumer.connectCalled, 1);
		strictEqual(consumer.subscriptions.length, 1);

		ac.abort();
		const final = await it.next();
		strictEqual(final.done, true);
		strictEqual(consumer.disconnectCalled, 1);
	});

	test("pollKafka subscribes with fromBeginning when configured", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t"],
			fromBeginning: true,
			consumer,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		strictEqual(consumer.subscriptions[0].fromBeginning, true);
		ac.abort();
		await firstNext;
	});

	test("pollKafka constructs default Kafka and consumer when not injected", () => {
		const poller = pollKafka({
			brokers: ["localhost:9092"],
			groupId: "g",
			topics: ["t"],
		});
		strictEqual(poller.source, "aws:kafka");
		ok(poller.consumer);
	});

	test("pollKafka selfManaged emits SelfManagedKafka eventSource", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t"],
			consumer,
			selfManaged: true,
		});
		strictEqual(poller.source, "SelfManagedKafka");
	});

	test("pollKafka eachBatch is a no-op when signal already aborted", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t"],
			consumer,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		ac.abort();
		const fn = consumer.runHandler();
		let resolved = 0;
		let heartbeats = 0;
		await fn({
			batch: { topic: "t", partition: 0, messages: [{ offset: "1" }] },
			resolveOffset: () => resolved++,
			commitOffsetsIfNecessary: async () => {},
			uncommittedOffsets: () => ({ topics: [] }),
			heartbeat: async () => {
				heartbeats++;
			},
		});
		strictEqual(resolved, 0);
		// The batch is dropped before the ack gate, so no trailing heartbeat either.
		strictEqual(heartbeats, 0);
		const r = await firstNext;
		strictEqual(r.done, true);
	});

	test("pollKafka.acknowledge tolerates undefined response", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t"],
			consumer,
		});
		await poller.acknowledge(undefined, undefined);
	});

	test("pollKafka encodes Uint8Array, string, and null key/value", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const fn = consumer.runHandler();
		const ebp = fn({
			batch: {
				topic: "t1",
				partition: 0,
				messages: [
					{
						offset: "1",
						timestamp: "1",
						key: new Uint8Array([1, 2]),
						value: "literal-string",
					},
					{ offset: "2", timestamp: "2", key: 42, value: undefined },
				],
			},
			resolveOffset: () => {},
			commitOffsetsIfNecessary: async () => {},
			uncommittedOffsets: () => ({ topics: [] }),
			heartbeat: async () => {},
		});
		const { value } = await firstNext;
		const records = value.records["t1-0"];
		strictEqual(records[0].key, Buffer.from([1, 2]).toString("base64"));
		strictEqual(
			records[0].value,
			Buffer.from("literal-string").toString("base64"),
		);
		strictEqual(records[1].key, Buffer.from("42").toString("base64"));
		strictEqual(records[1].value, null);
		await poller.acknowledge(value, { batchItemFailures: [] });
		await ebp;
		ac.abort();
		await it.next();
	});

	test("pollKafka swallows disconnect errors during abort", async () => {
		const consumer = makeFakeKafkaConsumer();
		consumer.disconnect = async () => {
			throw new Error("disc-fail");
		};
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t"],
			consumer,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		ac.abort();
		const r = await firstNext;
		strictEqual(r.done, true);
	});

	test("pollKafka releases its abort listener once the signal fires", async () => {
		// The runner's signal outlives the poller, so a listener left behind
		// would be a leak per poll().
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t"],
			consumer: makeFakeKafkaConsumer(),
		});
		const ac = new AbortController();
		const { firstNext } = await drainKafkaSetup(poller.poll(ac.signal));
		strictEqual(getEventListeners(ac.signal, "abort").length, 1);
		ac.abort();
		strictEqual((await firstNext).done, true);
		strictEqual(getEventListeners(ac.signal, "abort").length, 0);
	});

	test("pollKafka runs the consumer with autoCommit and eachBatchAutoResolve off", async () => {
		// With eachBatchAutoResolve left at its default (true) kafkajs resolves the
		// batch's last offset after eachBatch returns, so the next commit would skip
		// past a failed record instead of redelivering it.
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t"],
			consumer,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const config = consumer.runConfig();
		strictEqual(config.autoCommit, false);
		strictEqual(config.eachBatchAutoResolve, false);
		strictEqual(config.partitionsConsumedConcurrently, 1);
		ac.abort();
		await firstNext;
	});

	test("pollKafka skips the commit call when the first record failed", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			retryDelayMs: 0,
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const { calls, payload } = makeKafkaBatchPayload(kafkaBatchOf("5", "6"));
		const eachBatchPromise = consumer.runHandler()(payload);
		const { value } = await firstNext;
		await poller.acknowledge(value, {
			batchItemFailures: [{ itemIdentifier: { partition: "t1-0", offset: 5 } }],
		});
		await eachBatchPromise;
		deepStrictEqual(calls.resolved, []);
		deepStrictEqual(calls.commits, []);
		strictEqual(calls.heartbeats, 1);
		ac.abort();
		await it.next();
	});

	test("pollKafka SIGTERM mid-batch commits the handler's acknowledgement before disconnecting", async () => {
		const consumer = makeFakeKafkaConsumer();
		const order = [];
		consumer.disconnect = async () => {
			consumer.disconnectCalled++;
			order.push("disconnect");
		};
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const uncommitted = {
			topics: [{ topic: "t1", partitions: [{ partition: 0, offset: "8" }] }],
		};
		const { calls, payload } = makeKafkaBatchPayload(
			kafkaBatchOf("7"),
			uncommitted,
		);
		payload.commitOffsetsIfNecessary = async (offsets) => {
			calls.commits.push(offsets);
			order.push("commit");
		};
		const eachBatchPromise = consumer.runHandler()(payload);
		const { value } = await firstNext;

		// SIGTERM lands while the handler is still running the batch.
		ac.abort();
		for (let i = 0; i < 5; i++) await Promise.resolve();
		deepStrictEqual(calls.resolved, []);
		deepStrictEqual(calls.commits, []);
		strictEqual(consumer.disconnectCalled, 0);

		// The handler finishes and the runner acknowledges as usual.
		await poller.acknowledge(value, { batchItemFailures: [] });
		await eachBatchPromise;
		deepStrictEqual(calls.resolved, ["7"]);
		deepStrictEqual(calls.commits, [uncommitted]);

		const final = await it.next();
		strictEqual(final.done, true);
		strictEqual(consumer.disconnectCalled, 1);
		deepStrictEqual(order, ["commit", "disconnect"]);
	});

	test("pollKafka SIGTERM mid-batch with no acknowledgement resolves and commits nothing", async () => {
		// The handler threw after SIGTERM, so the runner never acknowledges. The
		// batch must be released without resolving or committing any offset so it
		// redelivers from the last committed offset after restart.
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const { calls, payload } = makeKafkaBatchPayload(kafkaBatchOf("7", "8"));
		const eachBatchPromise = consumer.runHandler()(payload);
		await firstNext;

		ac.abort();
		const final = await it.next();
		strictEqual(final.done, true);
		await eachBatchPromise;
		deepStrictEqual(calls.resolved, []);
		deepStrictEqual(calls.commits, []);
		strictEqual(consumer.disconnectCalled, 1);
	});

	test("pollKafka drains a rejecting eachBatch before disconnecting", async () => {
		// A failed commit rejects eachBatch (kafkajs handles the crash); shutdown
		// must still wait for it to settle and then disconnect.
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const { payload } = makeKafkaBatchPayload(kafkaBatchOf("7"));
		payload.commitOffsetsIfNecessary = async () => {
			throw new Error("commit-fail");
		};
		const eachBatchPromise = consumer.runHandler()(payload);
		const { value } = await firstNext;
		await poller.acknowledge(value, { batchItemFailures: [] });
		await rejects(eachBatchPromise, /commit-fail/);
		ac.abort();
		const final = await it.next();
		strictEqual(final.done, true);
		strictEqual(consumer.disconnectCalled, 1);
	});

	test("pollKafka releases a batch the handler threw on and delivers the next one", async () => {
		// The runner resumes the generator without acknowledging when the handler
		// throws. The batch must still be released (all records failed) so
		// eachBatch returns, kafkajs fetches the next batch and keeps heartbeating.
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
			retryDelayMs: 0,
		});
		const ac = new AbortController();
		const seen = [];
		const errors = [];
		const loop = runPollLoop({
			poller,
			handler: async (event) => {
				seen.push(event);
				if (seen.length === 1) throw new Error("boom");
				return { batchItemFailures: [] };
			},
			timeout: 1000,
			signal: ac.signal,
			onError: (err) => errors.push(err),
		});
		await settleMacrotask();

		const first = makeKafkaBatchPayload(kafkaBatchOf("1"));
		let firstSettled = false;
		const firstEachBatch = consumer
			.runHandler()(first.payload)
			.then(() => {
				firstSettled = true;
			});
		// retryDelayMs 0 still waits one timer tick.
		await sleep(5);
		strictEqual(firstSettled, true, "eachBatch returns for the failed batch");
		await firstEachBatch;
		deepStrictEqual(first.calls.resolved, []);
		deepStrictEqual(first.calls.commits, []);

		const uncommitted = {
			topics: [{ topic: "t1", partitions: [{ partition: 0, offset: "3" }] }],
		};
		const second = makeKafkaBatchPayload(kafkaBatchOf("2"), uncommitted);
		await consumer.runHandler()(second.payload);
		strictEqual(seen.length, 2);
		deepStrictEqual(second.calls.resolved, ["2"]);
		deepStrictEqual(second.calls.commits, [uncommitted]);

		ac.abort();
		await loop;
		deepStrictEqual(
			errors.map((e) => e.message),
			["boom"],
		);
		strictEqual(consumer.disconnectCalled, 1);
	});

	test("pollKafka heartbeats every heartbeatIntervalMs while the handler holds a batch", async (t) => {
		// A long handler would otherwise let the session time out and trigger a
		// rebalance; kafkajs throttles heartbeat() itself so the interval can be
		// short.
		t.mock.timers.enable({ apis: ["setInterval"] });
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const { calls, payload } = makeKafkaBatchPayload(kafkaBatchOf("1"));
		const eachBatchPromise = consumer.runHandler()(payload);
		const { value } = await firstNext;
		strictEqual(calls.heartbeats, 0);
		t.mock.timers.tick(3000);
		strictEqual(calls.heartbeats, 1);
		t.mock.timers.tick(3000);
		strictEqual(calls.heartbeats, 2);
		await poller.acknowledge(value, { batchItemFailures: [] });
		await eachBatchPromise;
		strictEqual(calls.heartbeats, 3, "final heartbeat after the commit");
		t.mock.timers.tick(30_000);
		strictEqual(calls.heartbeats, 3, "interval is cleared once released");
		ac.abort();
		await it.next();
	});

	test("pollKafka honours heartbeatIntervalMs and swallows heartbeat rejections", async (t) => {
		t.mock.timers.enable({ apis: ["setInterval"] });
		const unhandled = [];
		const guard = (err) => unhandled.push(err);
		process.on("unhandledRejection", guard);
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			retryDelayMs: 0,
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
			heartbeatIntervalMs: 500,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const { calls, payload } = makeKafkaBatchPayload(kafkaBatchOf("1"));
		let attempts = 0;
		payload.heartbeat = async () => {
			attempts++;
			throw new Error("REBALANCE_IN_PROGRESS");
		};
		const eachBatchPromise = consumer.runHandler()(payload);
		const { value } = await firstNext;
		t.mock.timers.tick(499);
		strictEqual(attempts, 0);
		t.mock.timers.tick(1);
		strictEqual(attempts, 1);
		await settleMacrotask();
		await poller.acknowledge(value, {
			batchItemFailures: [{ itemIdentifier: "t1-0-1" }],
		});
		// The trailing heartbeat is awaited and its rejection surfaces to kafkajs.
		await rejects(eachBatchPromise, /REBALANCE_IN_PROGRESS/);
		deepStrictEqual(calls.commits, []);
		process.removeListener("unhandledRejection", guard);
		deepStrictEqual(unhandled, []);
		ac.abort();
		await it.next();
	});

	test("pollKafka validator rejects heartbeatIntervalMs below 1", () => {
		throws(
			() =>
				pollKafkaValidateOptions({
					brokers: ["b1"],
					groupId: "g",
					topics: ["t1"],
					heartbeatIntervalMs: 0,
				}),
			TypeError,
		);
	});

	// --- pollAmq ----------------------------------------------------------------

	test("pollAmq validator requires connectOptions + destination", () => {
		throws(() => pollAmqValidateOptions({}), TypeError);
	});

	const makeFakeStompClient = () => {
		const acked = [];
		const nacked = [];
		const subscriptions = [];
		let subscribeCb;
		// stompit clients are EventEmitters ("error", "end").
		return Object.assign(new EventEmitter(), {
			acked,
			nacked,
			subscriptions,
			disconnectCalls: 0,
			subscribeCb: () => subscribeCb,
			subscribe(spec, cb) {
				subscriptions.push(spec);
				subscribeCb = cb;
			},
			ack(msg) {
				acked.push(msg);
			},
			nack(msg) {
				nacked.push(msg);
			},
			disconnect() {
				this.disconnectCalls++;
			},
		});
	};

	const fakeStompMessage = (id, body) => ({
		headers: {
			"message-id": id,
			"amq-msg-type": "jms/text-message",
			timestamp: "1700000000000",
			persistent: "true",
			priority: "5",
			destination: "/queue/orders",
			redelivered: "false",
		},
		readString(_enc, cb) {
			cb(null, body);
		},
	});

	const drainPollSetup = async (it) => {
		const firstNext = it.next();
		for (let i = 0; i < 8; i++) await Promise.resolve();
		return { firstNext };
	};

	test("pollAmq yields aws:amq batch and acks per-message based on response", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({
			connectOptions: { host: "localhost", port: 61613 },
			destination: "/queue/orders",
			batchSize: 2,
			batchWindowMs: 50,
			client: stomp,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		const cb = stomp.subscribeCb();
		cb(null, fakeStompMessage("id-1", "body-1"));
		cb(null, fakeStompMessage("id-2", "body-2"));
		const { value } = await firstNext;
		strictEqual(value.eventSource, "aws:amq");
		strictEqual(value.messages.length, 2);
		strictEqual(value.messages[0].messageID, "id-1");
		strictEqual(
			value.messages[0].data,
			Buffer.from("body-1", "utf-8").toString("base64"),
		);
		strictEqual(value.messages[0].deliveryMode, 2);
		strictEqual(value.messages[0].priority, 5);

		await poller.acknowledge(value, {
			batchItemFailures: [{ itemIdentifier: "id-2" }],
		});
		strictEqual(stomp.acked.length, 1);
		strictEqual(stomp.nacked.length, 1);
		ac.abort();
	});

	test("pollAmq defaultConnect resolves when stompit.connect succeeds", async () => {
		const stomp = makeFakeStompClient();
		const original = stompit.connect;
		stompit.connect = (_cfg, cb) => cb(null, stomp);
		try {
			const poller = pollAmq({
				connectOptions: {},
				destination: "/q",
				batchSize: 1,
				batchWindowMs: 5,
			});
			const ac = new AbortController();
			const it = poller.poll(ac.signal);
			await drainPollSetup(it);
			ac.abort();
			await it.next();
		} finally {
			stompit.connect = original;
		}
	});

	test("pollAmq defaultConnect rejects when stompit.connect errors", async () => {
		const original = stompit.connect;
		stompit.connect = (_cfg, cb) => cb(new Error("conn-refused"));
		try {
			const poller = pollAmq({
				connectOptions: {},
				destination: "/q",
			});
			const ac = new AbortController();
			const it = poller.poll(ac.signal);
			await rejects(() => it.next(), /conn-refused/);
		} finally {
			stompit.connect = original;
		}
	});

	test("pollAmq uses opts.connect factory when no client injected", async () => {
		const stomp = makeFakeStompClient();
		let connectCalls = 0;
		const poller = pollAmq({
			connectOptions: { host: "localhost" },
			destination: "/queue/x",
			batchSize: 1,
			batchWindowMs: 5,
			connect: async (cfg) => {
				connectCalls++;
				deepStrictEqual(cfg, { host: "localhost" });
				return stomp;
			},
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		strictEqual(connectCalls, 1);
		const cb = stomp.subscribeCb();
		cb(null, fakeStompMessage("m1", "body"));
		await firstNext;
		ac.abort();
	});

	test("pollAmq swallows client.disconnect errors during abort", async () => {
		const stomp = makeFakeStompClient();
		stomp.disconnect = () => {
			throw new Error("disc-fail");
		};
		const poller = pollAmq({
			connectOptions: {},
			destination: "/queue/x",
			batchSize: 1,
			batchWindowMs: 5,
			client: stomp,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		ac.abort();
		const r = await firstNext;
		strictEqual(r.done, true);
	});

	test("pollAmq releases its abort listener once the signal fires", async () => {
		const poller = pollAmq({ ...amqBase, client: makeFakeStompClient() });
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		strictEqual(getEventListeners(ac.signal, "abort").length, 1);
		ac.abort();
		strictEqual((await firstNext).done, true);
		strictEqual(getEventListeners(ac.signal, "abort").length, 0);
	});

	test("pollAmq windowing aborts mid-window via delay rejection", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({
			connectOptions: {},
			destination: "/queue/x",
			batchSize: 10,
			batchWindowMs: 5000,
			client: stomp,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		const cb = stomp.subscribeCb();
		cb(null, fakeStompMessage("m1", "x"));
		// Wait long enough for the generator to enter the inner while-delay loop,
		// then abort to trip delay()'s catch.
		await new Promise((r) => setTimeout(r, 10));
		ac.abort();
		const r = await firstNext;
		strictEqual(r.done, true);
	});

	test("pollAmq applies header defaults and continues iteration after yield", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({
			connectOptions: {},
			destination: "/queue/x",
			batchSize: 1,
			batchWindowMs: 5,
			client: stomp,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		const cb = stomp.subscribeCb();
		cb(null, {
			headers: { "message-id": "m" }, // all other headers missing
			readString(_e, cbb) {
				cbb(null, "x");
			},
		});
		const { value } = await firstNext;
		strictEqual(value.messages[0].messageType, "jms/text-message");
		strictEqual(value.messages[0].deliveryMode, 1);
		strictEqual(value.messages[0].priority, 4);
		strictEqual(value.messages[0].redelivered, false);
		// No destination header: fall back to the subscribed destination.
		deepStrictEqual(value.messages[0].destination, { physicalName: "x" });
		strictEqual(value.messages[0].replyTo, null);
		strictEqual(value.messages[0].type, null);
		strictEqual(value.messages[0].expiration, null);
		strictEqual(value.messages[0].correlationID, null);
		deepStrictEqual(value.messages[0].properties, {});
		await poller.acknowledge(value, undefined); // tolerates missing response
		strictEqual(stomp.acked.length, 1);
		ac.abort();
		const r = await it.next();
		strictEqual(r.done, true);
	});

	test("pollAmq.acknowledge tolerates unknown event", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({
			connectOptions: {},
			destination: "/q",
			client: stomp,
		});
		await poller.acknowledge({}, { batchItemFailures: [] });
		strictEqual(stomp.acked.length, 0);
	});

	test("pollAmq nacks message on body read failure", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({
			connectOptions: {},
			destination: "/queue/x",
			batchSize: 1,
			batchWindowMs: 5,
			client: stomp,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		await drainPollSetup(it);
		const cb = stomp.subscribeCb();
		const failingMsg = {
			headers: { "message-id": "x" },
			readString(_e, cbb) {
				cbb(new Error("io"));
			},
		};
		cb(null, failingMsg);
		for (let i = 0; i < 5; i++) await Promise.resolve();
		strictEqual(stomp.nacked.length, 1);
		ac.abort();
	});

	test("pollAmq lets an in-flight batch acknowledge on abort, then disconnects", async () => {
		// SIGTERM lands while the handler runs: the connection must stay open for
		// the acknowledge that follows, or every message redelivers.
		const log = [];
		const stomp = makeFakeStompClient();
		const ack = stomp.ack;
		stomp.ack = (msg) => {
			if (stomp.disconnectCalls) throw new Error("not connected");
			log.push("ack");
			ack(msg);
		};
		const disconnect = stomp.disconnect;
		stomp.disconnect = function () {
			log.push("disconnect");
			disconnect.call(this);
		};
		const poller = pollAmq({
			...amqBase,
			batchSize: 1,
			batchWindowMs: 0,
			client: stomp,
		});
		const ac = new AbortController();
		const errors = [];
		const loop = runPollLoop({
			poller,
			handler: async () => {
				log.push("handler start");
				ac.abort();
				await sleep(10);
				log.push("handler done");
				return { batchItemFailures: [] };
			},
			timeout: 1000,
			signal: ac.signal,
			onError: (err) => errors.push(err),
		});
		for (let i = 0; i < 8; i++) await Promise.resolve();
		stomp.subscribeCb()(null, fakeStompMessage("m1", "body"));
		await loop;
		deepStrictEqual(errors, []);
		deepStrictEqual(log, [
			"handler start",
			"handler done",
			"ack",
			"disconnect",
		]);
	});

	// stompit drops its connect-time "error" listener once connected, and a
	// dropped socket emits "error" on the client: unheard, it would be an
	// uncaught exception instead of reaching onError.
	test("pollAmq fails the poll when the client emits an error", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({ ...amqBase, client: stomp });
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		const err = new Error("socket hang up");
		stomp.emit("error", err);
		await rejects(firstNext, (e) => e === err);
		strictEqual(stomp.disconnectCalls, 1);
		strictEqual(getEventListeners(ac.signal, "abort").length, 0);
	});

	test("pollAmq fails the poll when the subscription reports an error", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({ ...amqBase, client: stomp });
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		const err = new Error("subscription-failed");
		stomp.subscribeCb()(err);
		await rejects(firstNext, (e) => e === err);
	});

	test("pollAmq raises an error that lands while a batch is in flight without settling the batch", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({
			...amqBase,
			batchSize: 1,
			batchWindowMs: 0,
			client: stomp,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		stomp.subscribeCb()(null, fakeStompMessage("m1", "body"));
		strictEqual((await firstNext).done, false);
		const err = new Error("socket hang up");
		stomp.emit("error", err);
		await rejects(it.next(), (e) => e === err);
		deepStrictEqual(stomp.nacked, []);
	});

	test("pollAmq swallows client.disconnect errors when the poll fails", async () => {
		const stomp = makeFakeStompClient();
		stomp.disconnect = () => {
			throw new Error("disc-fail");
		};
		const poller = pollAmq({ ...amqBase, client: stomp });
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		const err = new Error("socket hang up");
		stomp.emit("error", err);
		await rejects(firstNext, (e) => e === err);
	});

	// --- pollRmq ----------------------------------------------------------------

	test("pollRmq validator requires queue", () => {
		throws(() => pollRmqValidateOptions({}), TypeError);
	});

	const makeFakeRmqChannel = () => {
		const acked = [];
		const nacked = [];
		const nackArgs = [];
		const prefetches = [];
		const consumes = [];
		let consumeCb;
		// amqplib channels are EventEmitters ("error", "close").
		return Object.assign(new EventEmitter(), {
			acked,
			nacked,
			nackArgs,
			prefetches,
			consumes,
			closeCalls: 0,
			consumeCb: () => consumeCb,
			async prefetch(count) {
				prefetches.push(count);
			},
			async consume(queue, cb, opts) {
				consumes.push({ queue, opts });
				consumeCb = cb;
				return { consumerTag: "ctag-1" };
			},
			cancels: [],
			async cancel(consumerTag) {
				this.cancels.push(consumerTag);
			},
			ack(msg) {
				acked.push(msg);
			},
			nack(msg, allUpTo, requeue) {
				nacked.push(msg);
				nackArgs.push([allUpTo, requeue]);
			},
			async close() {
				this.closeCalls++;
			},
		});
	};

	const makeFakeRmqConnection = (channel) => ({
		createChannelCalls: 0,
		closeCalls: 0,
		async createChannel() {
			this.createChannelCalls++;
			return channel;
		},
		async close() {
			this.closeCalls++;
		},
	});

	test("pollRmq yields aws:rmq batch and acks per delivery tag", async () => {
		const channel = makeFakeRmqChannel();
		const connection = {
			async createChannel() {
				return channel;
			},
			async close() {},
		};
		const poller = pollRmq({
			queue: "orders",
			vhost: "/",
			batchSize: 2,
			batchWindowMs: 30,
			connection,
			channel,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		const cb = channel.consumeCb();
		const mkMsg = (tag, body) => ({
			fields: { deliveryTag: tag, redelivered: false },
			properties: {
				contentType: "application/json",
				headers: { x: 1 },
				deliveryMode: 2,
			},
			content: Buffer.from(body),
		});
		cb(mkMsg(1, "a"));
		cb(mkMsg(2, "b"));

		const { value } = await firstNext;
		strictEqual(value.eventSource, "aws:rmq");
		const records = value.rmqMessagesByQueue["orders::/"];
		strictEqual(records.length, 2);
		strictEqual(records[0].data, Buffer.from("a").toString("base64"));
		strictEqual(records[0].basicProperties.contentType, "application/json");
		strictEqual(records[0].basicProperties.deliveryMode, 2);

		await poller.acknowledge(value, {
			batchItemFailures: [{ itemIdentifier: "2" }],
		});
		strictEqual(channel.acked.length, 1);
		strictEqual(channel.nacked.length, 1);
		strictEqual(channel.acked[0].fields.deliveryTag, 1);
		strictEqual(channel.nacked[0].fields.deliveryTag, 2);

		ac.abort();
	});

	test("pollRmq uses default amqplib.connect when no connection or opts.connect", async () => {
		const channel = makeFakeRmqChannel();
		const original = amqplib.connect;
		amqplib.connect = async () => ({
			async createChannel() {
				return channel;
			},
			async close() {},
		});
		try {
			const poller = pollRmq({
				queue: "q",
				url: "amqp://x",
				batchSize: 1,
				batchWindowMs: 5,
			});
			const ac = new AbortController();
			const it = poller.poll(ac.signal);
			await drainPollSetup(it);
			ac.abort();
			await it.next();
		} finally {
			amqplib.connect = original;
		}
	});

	test("pollRmq uses opts.connect factory when no connection injected", async () => {
		const channel = makeFakeRmqChannel();
		let connectCalls = 0;
		const poller = pollRmq({
			queue: "q",
			url: "amqp://x",
			batchSize: 1,
			batchWindowMs: 5,
			connect: async (url) => {
				connectCalls++;
				strictEqual(url, "amqp://x");
				return {
					async createChannel() {
						return channel;
					},
					async close() {},
				};
			},
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		strictEqual(connectCalls, 1);
		const cb = channel.consumeCb();
		cb({
			fields: { deliveryTag: 1 },
			properties: {},
			content: Buffer.from("y"),
		});
		await firstNext;
		ac.abort();
	});

	test("pollRmq lets an in-flight batch acknowledge on abort, then closes", async () => {
		// SIGTERM lands while the handler runs: the channel must stay open for
		// the acknowledge that follows, or every delivery redelivers.
		const log = [];
		const channel = makeFakeRmqChannel();
		const ack = channel.ack;
		channel.ack = (msg) => {
			if (channel.closeCalls) throw new Error("Channel closed");
			log.push("ack");
			ack(msg);
		};
		channel.cancel = async (consumerTag) => {
			log.push(`cancel ${consumerTag}`);
		};
		const close = channel.close;
		channel.close = async function () {
			log.push("channel.close");
			await close.call(this);
		};
		const poller = pollRmq({
			queue: "q",
			batchSize: 1,
			batchWindowMs: 0,
			connection: {
				async createChannel() {
					return channel;
				},
				async close() {
					log.push("connection.close");
				},
			},
			channel,
		});
		const ac = new AbortController();
		const errors = [];
		const loop = runPollLoop({
			poller,
			handler: async () => {
				log.push("handler start");
				ac.abort();
				await sleep(10);
				log.push("handler done");
				return { batchItemFailures: [] };
			},
			timeout: 1000,
			signal: ac.signal,
			onError: (err) => errors.push(err),
		});
		for (let i = 0; i < 8; i++) await Promise.resolve();
		channel.consumeCb()({
			fields: { deliveryTag: 1, redelivered: false },
			properties: {},
			content: Buffer.from("x"),
		});
		await loop;
		deepStrictEqual(errors, []);
		deepStrictEqual(log, [
			"handler start",
			"cancel ctag-1",
			"handler done",
			"ack",
			"channel.close",
			"connection.close",
		]);
	});

	test("pollRmq closes the channel and connection when the poll ends on abort while idle", async () => {
		const channel = makeFakeRmqChannel();
		const connection = makeFakeRmqConnection(channel);
		const poller = pollRmq({ queue: "q", connection, channel });
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		ac.abort();
		strictEqual((await firstNext).done, true);
		deepStrictEqual(channel.cancels, ["ctag-1"]);
		strictEqual(channel.closeCalls, 1);
		strictEqual(connection.closeCalls, 1);
	});

	test("pollRmq swallows a cancel error on abort", async () => {
		const channel = makeFakeRmqChannel();
		channel.cancel = async () => {
			throw new Error("cancel-fail");
		};
		const connection = makeFakeRmqConnection(channel);
		const poller = pollRmq({ queue: "q", connection, channel });
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		ac.abort();
		strictEqual((await firstNext).done, true);
		strictEqual(channel.closeCalls, 1);
	});

	test("pollRmq swallows close errors during abort", async () => {
		const channel = makeFakeRmqChannel();
		channel.close = async () => {
			throw new Error("ch-close-fail");
		};
		const closeErr = async () => {
			throw new Error("conn-close-fail");
		};
		const poller = pollRmq({
			queue: "q",
			batchSize: 1,
			batchWindowMs: 5,
			connection: {
				close: closeErr,
				async createChannel() {
					return channel;
				},
			},
			channel,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		ac.abort();
		const r = await firstNext;
		strictEqual(r.done, true);
	});

	test("pollRmq releases its abort listener once the signal fires", async () => {
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			connection: {
				async close() {},
				async createChannel() {
					return channel;
				},
			},
			channel,
		});
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		strictEqual(getEventListeners(ac.signal, "abort").length, 1);
		ac.abort();
		strictEqual((await firstNext).done, true);
		strictEqual(getEventListeners(ac.signal, "abort").length, 0);
	});

	test("pollRmq renders AMQP timestamps in Lambda's en-US medium UTC format", async () => {
		// Epoch seconds in, "Jan 1, 1970, 12:33:41 AM" style out: no zero-padded
		// day or hour, 12-hour clock with 12 for midnight and noon, padded
		// minutes and seconds.
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			batchSize: 4,
			batchWindowMs: 5,
			connection: {
				async close() {},
				async createChannel() {
					return channel;
				},
			},
			channel,
		});
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		const cb = channel.consumeCb();
		const cases = [
			[2021, "Jan 1, 1970, 12:33:41 AM"],
			[1_699_963_200, "Nov 14, 2023, 12:00:00 PM"],
			[1_700_000_000, "Nov 14, 2023, 10:13:20 PM"],
			[1_709_216_461, "Feb 29, 2024, 2:21:01 PM"],
		];
		for (const [i, [timestamp]] of cases.entries()) {
			cb({
				fields: { deliveryTag: i + 1, redelivered: false },
				properties: { timestamp },
				content: Buffer.from(""),
			});
		}
		const { value } = await firstNext;
		deepStrictEqual(
			value.rmqMessagesByQueue["q::/"].map(
				(record) => record.basicProperties.timestamp,
			),
			cases.map(([, rendered]) => rendered),
		);
		ac.abort();
	});

	test("pollRmq windowing aborts mid-window via delay rejection", async () => {
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			batchSize: 10,
			batchWindowMs: 5000,
			connection: {
				async createChannel() {
					return channel;
				},
				async close() {},
			},
			channel,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		const cb = channel.consumeCb();
		cb({
			fields: { deliveryTag: 1 },
			properties: {},
			content: Buffer.from("x"),
		});
		await new Promise((r) => setTimeout(r, 10));
		ac.abort();
		const r = await firstNext;
		strictEqual(r.done, true);
	});

	test("pollRmq.acknowledge tolerates unknown event", async () => {
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			connection: {
				async createChannel() {
					return channel;
				},
				async close() {},
			},
			channel,
		});
		await poller.acknowledge({}, { batchItemFailures: [] });
		strictEqual(channel.acked.length, 0);
	});

	test("pollRmq continues iteration after yield (covers loop end)", async () => {
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			batchSize: 1,
			batchWindowMs: 5,
			connection: {
				async createChannel() {
					return channel;
				},
				async close() {},
			},
			channel,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		const cb = channel.consumeCb();
		cb({
			fields: { deliveryTag: 1 },
			properties: {},
			content: Buffer.from("a"),
		});
		const { value } = await firstNext;
		await poller.acknowledge(value, undefined);
		ac.abort();
		const r = await it.next();
		strictEqual(r.done, true);
	});

	test("pollRmq applies basicProperties defaults when fields are missing", async () => {
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			batchSize: 1,
			batchWindowMs: 5,
			connection: {
				async createChannel() {
					return channel;
				},
				async close() {},
			},
			channel,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		const cb = channel.consumeCb();
		cb({
			fields: { deliveryTag: 1 },
			properties: {},
			content: Buffer.from("x"),
		});
		const { value } = await firstNext;
		const r = value.rmqMessagesByQueue["q::/"][0];
		strictEqual(r.basicProperties.contentType, null);
		strictEqual(r.basicProperties.deliveryMode, 1);
		// An absent AMQP timestamp is null, never a rendering of "Invalid Date".
		strictEqual(r.basicProperties.timestamp, null);
		strictEqual(r.redelivered, false);
		ac.abort();
	});

	// --- additional runner branches ---------------------------------------------

	test("runPollLoop breaks if signal aborts after a yield", async () => {
		const ac = new AbortController();
		let calls = 0;
		const poller = {
			source: "x",
			async *poll() {
				yield { Records: [1] };
				ac.abort();
				yield { Records: [2] };
			},
			async acknowledge() {
				calls++;
			},
		};
		await runPollLoop({
			poller,
			handler: async () => ({ batchItemFailures: [] }),
			timeout: 1000,
			signal: ac.signal,
		});
		// First event is processed; second yield comes after abort and the loop's
		// signal.aborted check must short-circuit before another handler invoke.
		strictEqual(calls, 1);
	});

	test("runWorker uses default exitImpl when not injected", async () => {
		const poller = stubPoller();
		const { onSigterm, loopPromise } = await runWorker({
			handler: async () => ({ batchItemFailures: [] }),
			poller,
			timeout: 1000,
			gracefulShutdownMs: 1000,
		});
		await loopPromise;
		process.removeListener("SIGTERM", onSigterm);
		// don't call onSigterm, it would invoke the real process.exit
	});

	test("runPrimary uses default cluster impl when none injected", async () => {
		delete process.env.ECS_CONTAINER_METADATA_URI_V4;
		const { onSigterm } = await runPrimary({ workers: 0 });
		process.removeListener("SIGTERM", onSigterm);
	});

	test("runPrimary uses default fetch when only cluster injected", async () => {
		const fakeCluster = {
			isPrimary: true,
			workers: {},
			fork: noop,
			on: noop,
		};
		const { onSigterm } = await runPrimary(
			{ workers: 0 },
			{ cluster: fakeCluster },
		);
		process.removeListener("SIGTERM", onSigterm);
	});

	test("runPrimary onSigterm tolerates undefined and missing worker entries", async () => {
		const fakeCluster = {
			isPrimary: true,
			workers: { 1: undefined },
			fork: noop,
			on: noop,
		};
		const { onSigterm } = await runPrimary(
			{ workers: 0 },
			{ cluster: fakeCluster, fetch: async () => ({ ok: false }) },
		);
		onSigterm();
		process.removeListener("SIGTERM", onSigterm);
	});

	test("runPrimary onSigterm tolerates missing cluster.workers and exits at once", async () => {
		const fakeCluster = { isPrimary: true, fork: noop, on: noop };
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 0 },
			{
				cluster: fakeCluster,
				fetch: async () => ({ ok: false }),
				exit: (code) => exits.push(code),
			},
		);
		onSigterm();
		process.removeListener("SIGTERM", onSigterm);
		deepStrictEqual(exits, [0]);
	});

	test("runWorker reports a poller failure through onError and exits 1", async () => {
		// A throw inside the poll loop must not surface as an unhandledRejection:
		// that would kill the worker without reaching onError.
		const unhandled = [];
		const guard = (err) => unhandled.push(err);
		process.on("unhandledRejection", guard);
		const boom = new Error("ProvisionedThroughputExceededException");
		const errors = [];
		const exits = [];
		const poller = {
			source: "test",
			async *poll() {
				yield { Records: [1] };
				throw boom;
			},
			acknowledge: noop,
		};
		const { onSigterm } = await runWorker(
			{
				handler: async () => ({ batchItemFailures: [] }),
				poller,
				timeout: 1000,
				gracefulShutdownMs: 1000,
				onError: (err) => errors.push(err),
			},
			{ exit: (code) => exits.push(code) },
		);
		// unhandledRejection is emitted once the microtask queue has drained.
		await new Promise((r) => setImmediate(r));
		process.removeListener("unhandledRejection", guard);
		process.removeListener("SIGTERM", onSigterm);
		deepStrictEqual(unhandled, []);
		deepStrictEqual(errors, [boom]);
		deepStrictEqual(exits, [1]);
	});

	test("runWorker exits 1 even when onError throws on a poller failure", async () => {
		// A throwing onError (logger down) must not leave a worker alive with a
		// dead poll loop, and must not surface as an unhandledRejection either.
		const unhandled = [];
		const guard = (err) => unhandled.push(err);
		process.on("unhandledRejection", guard);
		const loggerDown = new Error("logger down");
		const exits = [];
		const poller = {
			source: "test",
			async *poll() {
				yield { Records: [1] };
				throw new Error("poll failed");
			},
			acknowledge: noop,
		};
		const { onSigterm } = await runWorker(
			{
				handler: async () => ({ batchItemFailures: [] }),
				poller,
				timeout: 1000,
				gracefulShutdownMs: 1000,
				onError: () => {
					throw loggerDown;
				},
			},
			{ exit: (code) => exits.push(code) },
		);
		await settleMacrotask();
		process.removeListener("unhandledRejection", guard);
		process.removeListener("SIGTERM", onSigterm);
		deepStrictEqual(exits, [1]);
		deepStrictEqual(unhandled, []);
	});

	test("pollDynamoDBStreams derives awsRegion from the stream ARN and passes a numeric ApproximateCreationDateTime through", async () => {
		// Lambda always populates awsRegion and eventSourceARN; the ARN carries
		// the region so the option is only an override.
		const streamArn = "arn:aws:dynamodb:eu-west-1:111:table/t/stream/2024";
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return {
					NextShardIterator: null,
					Records: [
						{
							eventID: "e1",
							eventName: "INSERT",
							eventVersion: "1.1",
							dynamodb: {
								SequenceNumber: "1",
								ApproximateCreationDateTime: 1_700_000_000,
							},
						},
					],
				};
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn,
			shardId: "shard-0",
			client,
		});
		const { value } = await poller.poll(new AbortController().signal).next();
		const [record] = value.Records;
		strictEqual(record.awsRegion, "eu-west-1");
		strictEqual(record.eventSourceARN, streamArn);
		strictEqual(record.dynamodb.ApproximateCreationDateTime, 1_700_000_000);
	});

	test("pollKinesis derives awsRegion from streamArn when the option is omitted", async () => {
		const streamArn = "arn:aws:kinesis:ap-southeast-2:111:stream/events";
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return {
					NextShardIterator: null,
					Records: [
						{
							PartitionKey: "p",
							SequenceNumber: "1",
							Data: Buffer.from("x"),
							ApproximateArrivalTimestamp: 1_700_000_000,
						},
					],
				};
			},
		};
		const poller = pollKinesis({
			streamName: "events",
			shardId: "shard-0",
			streamArn,
			client,
		});
		const { value } = await poller.poll(new AbortController().signal).next();
		const [record] = value.Records;
		strictEqual(record.awsRegion, "ap-southeast-2");
		strictEqual(record.eventSourceARN, streamArn);
	});

	// --- Lambda event contract (fixtures/) -------------------------------------
	// Each poller must emit the record shape Lambda delivers for the same source,
	// so a handler built for a Lambda event source mapping runs unchanged. Fake
	// SDK/broker inputs are derived from the documented fixtures and the produced
	// event is compared with deepStrictEqual. fixtures/README.md
	// cites the AWS doc each field traces to.

	const loadFixture = (kind) =>
		JSON.parse(
			readFileSync(new URL(`./fixtures/${kind}.json`, import.meta.url), "utf8"),
		);

	const omit = (obj, ...keys) =>
		Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

	test("pollSqs maps ReceiveMessage messages to the documented Lambda record shape", async () => {
		const fixture = loadFixture("sqs.standard");
		const [plain, binary] = fixture.Records;
		const ac = new AbortController();
		const client = {
			send: async () => {
				ac.abort();
				return {
					Messages: [
						{
							MessageId: plain.messageId,
							ReceiptHandle: plain.receiptHandle,
							Body: plain.body,
							Attributes: plain.attributes,
							MessageAttributes: {
								myAttribute: { StringValue: "myValue", DataType: "String" },
							},
							MD5OfBody: plain.md5OfBody,
						},
						{
							MessageId: binary.messageId,
							ReceiptHandle: binary.receiptHandle,
							Body: binary.body,
							Attributes: binary.attributes,
							MessageAttributes: {
								myBinaryAttribute: {
									BinaryValue: new Uint8Array([1, 2, 3]),
									DataType: "Binary",
								},
							},
							MD5OfBody: binary.md5OfBody,
							MD5OfMessageAttributes: binary.md5OfMessageAttributes,
						},
					],
				};
			},
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-2.amazonaws.com/123456789012/my-queue",
			client,
		});
		const { value } = await poller.poll(ac.signal).next();
		deepStrictEqual(value, fixture);
	});

	test("pollSqs.acknowledge raises DeleteMessageBatch Failed entries instead of treating them as deleted", async () => {
		const client = {
			send: async () => ({
				Successful: [{ Id: "0" }],
				Failed: [
					{
						Id: "1",
						Code: "ReceiptHandleIsInvalid",
						Message: "The receipt handle has expired",
						SenderFault: true,
					},
				],
			}),
		};
		const poller = pollSqs({
			queueUrl: "https://sqs.us-east-1.amazonaws.com/111/q",
			client,
		});
		const event = {
			Records: [
				{ messageId: "m1", receiptHandle: "rh1" },
				{ messageId: "m2", receiptHandle: "rh2" },
			],
		};
		await rejects(
			poller.acknowledge(event, { batchItemFailures: [] }),
			(err) => {
				strictEqual(err.message, "DeleteMessageBatch reported failed entries");
				strictEqual(err.cause.package, "@middy/ecs-batch/pollSqs");
				deepStrictEqual(err.cause.data.failed, [
					{
						messageId: "m2",
						receiptHandle: "rh2",
						code: "ReceiptHandleIsInvalid",
						message: "The receipt handle has expired",
						senderFault: true,
					},
				]);
				return true;
			},
		);
	});

	test("pollKinesis maps GetRecords records to the documented Lambda record shape", async () => {
		const fixture = loadFixture("kinesis.standard");
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return {
					NextShardIterator: null,
					Records: fixture.Records.map((r) => ({
						PartitionKey: r.kinesis.partitionKey,
						SequenceNumber: r.kinesis.sequenceNumber,
						Data: Buffer.from(r.kinesis.data, "base64"),
						ApproximateArrivalTimestamp: new Date(
							Math.round(r.kinesis.approximateArrivalTimestamp * 1000),
						),
					})),
				};
			},
		};
		const poller = pollKinesis({
			streamName: "lambda-stream",
			shardId: "shardId-000000000006",
			streamArn: fixture.Records[0].eventSourceARN,
			awsRegion: fixture.Records[0].awsRegion,
			client,
		});
		const { value } = await poller.poll(new AbortController().signal).next();
		// invokeIdentityArn is the IAM role Lambda's own poller assumed to read the
		// stream; the runner has no equivalent and does not emit it.
		deepStrictEqual(
			value.Records,
			fixture.Records.map((r) => omit(r, "invokeIdentityArn")),
		);
	});

	test("pollDynamoDBStreams maps GetRecords records to the documented Lambda record shape", async () => {
		const fixture = loadFixture("ddb.new-and-old");
		const [insert, remove] = fixture.Records;
		// The SDK returns ApproximateCreationDateTime as a Date and userIdentity as
		// the Streams API Identity shape ({ PrincipalId, Type }).
		const toSdkRecord = (r) => ({
			eventID: r.eventID,
			eventName: r.eventName,
			eventVersion: r.eventVersion,
			eventSource: "aws:dynamodb",
			awsRegion: r.awsRegion,
			dynamodb: {
				...r.dynamodb,
				ApproximateCreationDateTime: new Date(
					r.dynamodb.ApproximateCreationDateTime * 1000,
				),
			},
		});
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return {
					NextShardIterator: null,
					Records: [
						toSdkRecord(insert),
						{
							...toSdkRecord(remove),
							userIdentity: {
								PrincipalId: remove.userIdentity.principalId,
								Type: remove.userIdentity.type,
							},
						},
					],
				};
			},
		};
		const poller = pollDynamoDBStreams({
			streamArn: insert.eventSourceARN,
			shardId: "shardId-0",
			awsRegion: insert.awsRegion,
			client,
		});
		const { value } = await poller.poll(new AbortController().signal).next();
		deepStrictEqual(value, fixture);
	});

	const kafkaBatchFromFixture = (fixture) => {
		const record = fixture.records["mytopic-0"][0];
		return {
			topic: record.topic,
			partition: record.partition,
			messages: [
				{
					offset: String(record.offset),
					timestamp: String(record.timestamp),
					key: Buffer.from(record.key, "base64"),
					value: Buffer.from(record.value, "base64"),
					headers: { headerKey: Buffer.from(record.headers[0].headerKey) },
				},
			],
		};
	};

	// AWS's example key is not canonical base64 (its last sextet carries stray
	// low bits), so it cannot survive a decode/encode round trip. Compare against
	// the canonical encoding of the same bytes.
	const expectedKafkaEvent = (fixture) => {
		const record = fixture.records["mytopic-0"][0];
		return {
			...fixture,
			records: {
				"mytopic-0": [
					{
						...record,
						key: Buffer.from(record.key, "base64").toString("base64"),
					},
				],
			},
		};
	};

	test("pollKafka emits the documented MSK event and honours object batchItemFailures identifiers", async () => {
		const fixture = loadFixture("msk.standard");
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			retryDelayMs: 0,
			brokers: fixture.bootstrapServers.split(","),
			groupId: "g",
			topics: ["mytopic"],
			consumer,
			eventSourceArn: fixture.eventSourceArn,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const resolveCalls = [];
		const eachBatchPromise = consumer.runHandler()({
			batch: kafkaBatchFromFixture(fixture),
			resolveOffset: (o) => resolveCalls.push(o),
			commitOffsetsIfNecessary: async () => {},
			uncommittedOffsets: () => ({ topics: [] }),
			heartbeat: async () => {},
		});
		const { value } = await firstNext;
		deepStrictEqual(value, expectedKafkaEvent(fixture));
		// @middy/event-batch-response reports Kafka failures as
		// { partition: "topic-partition", offset } objects (Lambda's own contract).
		await poller.acknowledge(value, {
			batchItemFailures: [
				{ itemIdentifier: { partition: "mytopic-0", offset: 15 } },
			],
		});
		await eachBatchPromise;
		deepStrictEqual(resolveCalls, []);
		ac.abort();
		await it.next();
	});

	test("pollKafka selfManaged emits the documented SelfManagedKafka event without eventSourceArn", async () => {
		const fixture = loadFixture("kafka.self-managed");
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			retryDelayMs: 0,
			brokers: fixture.bootstrapServers.split(","),
			groupId: "g",
			topics: ["mytopic"],
			consumer,
			selfManaged: true,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const resolveCalls = [];
		const eachBatchPromise = consumer.runHandler()({
			batch: kafkaBatchFromFixture(fixture),
			resolveOffset: (o) => resolveCalls.push(o),
			commitOffsetsIfNecessary: async () => {},
			uncommittedOffsets: () => ({ topics: [] }),
			heartbeat: async () => {},
		});
		const { value } = await firstNext;
		deepStrictEqual(value, expectedKafkaEvent(fixture));
		// An object identifier for an offset that is not in the batch invalidates
		// the response: nothing resolves and the whole batch is retried.
		// https://docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html
		await rejects(
			() =>
				poller.acknowledge(value, {
					batchItemFailures: [
						{ itemIdentifier: { partition: "mytopic-0", offset: 99 } },
					],
				}),
			/Invalid batchItemFailures entry/,
		);
		await eachBatchPromise;
		deepStrictEqual(resolveCalls, []);
		ac.abort();
		await it.next();
	});

	test("pollKafka encodes string, multi-value, non-buffer and undefined header values", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t"],
			consumer,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const ebp = consumer.runHandler()({
			batch: {
				topic: "t",
				partition: 0,
				messages: [
					{
						offset: "1",
						timestamp: "1",
						key: null,
						value: null,
						headers: {
							text: "hv",
							multi: [Buffer.from("a"), "b"],
							none: undefined,
							num: 7,
							// Not valid UTF-8: a string round trip would replace the bytes.
							bin: Buffer.from([0xff, 0x00, 0xfe]),
						},
					},
				],
			},
			resolveOffset: noop,
			commitOffsetsIfNecessary: async () => {},
			uncommittedOffsets: () => ({ topics: [] }),
			heartbeat: async () => {},
		});
		const { value } = await firstNext;
		deepStrictEqual(value.records["t-0"][0].headers, [
			{ text: [104, 118] },
			{ multi: [97] },
			{ multi: [98] },
			{ num: [55] },
			{ bin: [255, 0, 254] },
		]);
		await poller.acknowledge(value, { batchItemFailures: [] });
		await ebp;
		ac.abort();
		await it.next();
	});

	test("pollAmq maps a STOMP MESSAGE frame to the documented Lambda message shape", async () => {
		const fixture = loadFixture("mq.activemq");
		const msg = fixture.messages[0];
		const stomp = makeFakeStompClient();
		const poller = pollAmq({
			connectOptions: {},
			destination: "/queue/testQueue",
			batchSize: 1,
			batchWindowMs: 5,
			client: stomp,
			eventSourceArn: fixture.eventSourceArn,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		// Header names follow ActiveMQ's STOMP FrameTranslator; JMS user
		// properties arrive as additional headers.
		stomp.subscribeCb()(null, {
			headers: {
				"message-id": msg.messageID,
				destination: "/queue/testQueue",
				"correlation-id": msg.correlationID,
				expires: msg.expiration,
				priority: String(msg.priority),
				timestamp: String(msg.timestamp),
				subscription: "sub-0",
				"content-type": "text/plain",
				index: "1",
				doAlarm: "false",
				myCustomProperty: "value",
			},
			readString(_enc, cb) {
				cb(null, Buffer.from(msg.data, "base64").toString("utf8"));
			},
		});
		const { value } = await firstNext;
		strictEqual(value.eventSourceArn, fixture.eventSourceArn);
		// brokerInTime/brokerOutTime are OpenWire broker statistics; ActiveMQ's
		// STOMP frames never carry them, so the runner cannot emit them.
		deepStrictEqual(
			value.messages[0],
			omit(msg, "brokerInTime", "brokerOutTime"),
		);
		ac.abort();
	});

	test("pollAmq copies reply-to, type, persistent and redelivered STOMP headers", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({
			connectOptions: {},
			destination: "/topic/events",
			batchSize: 1,
			batchWindowMs: 5,
			client: stomp,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		stomp.subscribeCb()(null, {
			headers: {
				"message-id": "m",
				destination: "/topic/events",
				"reply-to": "/queue/replies",
				type: "OrderCreated",
				persistent: "true",
				redelivered: "true",
				expires: "0",
			},
			readString(_enc, cb) {
				cb(null, "x");
			},
		});
		const { value } = await firstNext;
		const [message] = value.messages;
		deepStrictEqual(message.destination, { physicalName: "events" });
		strictEqual(message.replyTo, "/queue/replies");
		strictEqual(message.type, "OrderCreated");
		strictEqual(message.expiration, "0");
		strictEqual(message.deliveryMode, 2);
		strictEqual(message.redelivered, true);
		deepStrictEqual(message.properties, {});
		ac.abort();
	});

	test("pollRmq maps an amqplib message to the documented Lambda message shape", async () => {
		const fixture = loadFixture("mq.rabbitmq");
		const msg = fixture.rmqMessagesByQueue["pizzaQueue::/"][0];
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "pizzaQueue",
			vhost: "/",
			batchSize: 1,
			batchWindowMs: 5,
			connection: {
				async createChannel() {
					return channel;
				},
				async close() {},
			},
			channel,
			eventSourceArn: fixture.eventSourceArn,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		const content = Buffer.from(msg.data, "base64");
		channel.consumeCb()({
			fields: { deliveryTag: 1, redelivered: false },
			properties: {
				contentType: "text/plain",
				// amqplib decodes AMQP long strings to JS strings and byte arrays to
				// Buffers; Lambda serialises both as { bytes: [...] }.
				headers: {
					header1: "value1",
					header2: Buffer.from("value2"),
					numberInHeader: 10,
				},
				deliveryMode: 1,
				priority: 34,
				expiration: "60000",
				// AMQP timestamps are epoch seconds; 2021 is the value behind the
				// documented "Jan 1, 1970, 12:33:41 AM".
				timestamp: 2021,
				userId: "AIDACKCEVSQ6C2EXAMPLE",
			},
			content,
		});
		const { value } = await firstNext;
		// AWS's example bodySize (80) does not match its own 43-byte payload;
		// bodySize is the body length in bytes.
		deepStrictEqual(value, {
			...fixture,
			rmqMessagesByQueue: {
				"pizzaQueue::/": [
					{
						...msg,
						basicProperties: {
							...msg.basicProperties,
							bodySize: content.length,
						},
					},
				],
			},
		});
		ac.abort();
	});

	test("ecsBatchValidateOptions accepts onError", () => {
		ecsBatchValidateOptions({
			handler: noop,
			poller: { source: "x", poll: noop, acknowledge: noop },
			onError: noop,
		});
	});

	// --- index.js: option schema, task metadata and lifecycle details -----------

	const ecsEnvNames = [
		"MIDDY_ECS_ACCOUNTID",
		"MIDDY_ECS_REGION",
		"MIDDY_ECS_TASKARN",
		"MIDDY_ECS_FAMILY",
		"MIDDY_ECS_REVISION",
	];
	const clearEcsEnv = () => {
		for (const name of ecsEnvNames) delete process.env[name];
	};

	const validRunnerOptions = {
		handler: noop,
		poller: { source: "x", poll: noop, acknowledge: noop },
	};

	test("ecsBatchValidateOptions reports the package in the error cause", () => {
		throws(
			() => ecsBatchValidateOptions({}),
			(err) => {
				strictEqual(err.cause.package, "@middy/ecs-batch");
				return true;
			},
		);
	});

	test("ecsBatchValidateOptions checks every poller field and allows poller extras", () => {
		const { poller } = validRunnerOptions;
		for (const broken of [
			{},
			{ ...poller, source: undefined },
			{ ...poller, poll: undefined },
			{ ...poller, acknowledge: undefined },
			{ ...poller, source: 1 },
			{ ...poller, poll: "poll" },
			{ ...poller, acknowledge: {} },
		]) {
			throws(
				() => ecsBatchValidateOptions({ handler: noop, poller: broken }),
				TypeError,
				JSON.stringify(broken),
			);
		}
		// Pollers carry their client or consumer next to the contract fields.
		ecsBatchValidateOptions({
			handler: noop,
			poller: { ...poller, client: {}, consumer: {} },
		});
	});

	test("ecsBatchValidateOptions accepts contextOverride.awsRequestId and nothing else in it", () => {
		ecsBatchValidateOptions({
			...validRunnerOptions,
			contextOverride: { awsRequestId: () => "id" },
		});
		ecsBatchValidateOptions({ ...validRunnerOptions, contextOverride: {} });
		for (const contextOverride of [
			{ awsRequestId: "id" },
			{ requestId: noop },
			"x",
		]) {
			throws(
				() =>
					ecsBatchValidateOptions({ ...validRunnerOptions, contextOverride }),
				TypeError,
				JSON.stringify(contextOverride),
			);
		}
	});

	test("ecsBatchRunner applies the timeout and gracefulShutdownMs defaults", async (t) => {
		t.mock.timers.enable({ apis: ["Date"], now: 1_000 });
		let remaining;
		let drained = false;
		const poller = {
			source: "test",
			async *poll(signal) {
				yield { Records: [1] };
				// Hold the loop open until SIGTERM, then take a moment to drain.
				await new Promise((r) => signal.addEventListener("abort", () => r()));
				await sleep(20);
				drained = true;
			},
			acknowledge: noop,
		};
		const exits = [];
		const { onSigterm } = await ecsBatchRunner(
			{
				handler: async (_event, context) => {
					remaining = context.getRemainingTimeInMillis();
					return { batchItemFailures: [] };
				},
				poller,
			},
			{ cluster: { isPrimary: false }, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		await settleMacrotask();
		strictEqual(remaining, 60_000);
		await onSigterm();
		strictEqual(drained, true);
		// 20 ms is well inside the 25 s budget, so the deadline never fired.
		deepStrictEqual(exits, [0]);
	});

	test("ecsBatchRunner forks workers on the primary instead of polling", async () => {
		const cluster = makeFakeCluster();
		let handled = 0;
		const result = await ecsBatchRunner(
			{
				handler: async () => {
					handled++;
					return { batchItemFailures: [] };
				},
				poller: stubPoller([{ Records: [1] }]),
				workers: 2,
			},
			{ cluster, fetch: noMeta },
		);
		process.removeListener("SIGTERM", result.onSigterm);
		await settleMacrotask();
		strictEqual(cluster.forks, 2);
		strictEqual(handled, 0);
		deepStrictEqual(Object.keys(result), ["onSigterm"]);
	});

	test("runWorker and runPrimary register onSigterm as a SIGTERM listener", async () => {
		const worker = await runWorker(
			{
				handler: noop,
				poller: stubPoller(),
				timeout: 1000,
				gracefulShutdownMs: 1000,
			},
			{ exit: noop },
		);
		ok(process.listeners("SIGTERM").includes(worker.onSigterm));
		process.removeListener("SIGTERM", worker.onSigterm);
		await worker.loopPromise;
		const primary = await runPrimary(
			{ workers: 0 },
			{ cluster: makeFakeCluster(), fetch: noMeta },
		);
		ok(process.listeners("SIGTERM").includes(primary.onSigterm));
		process.removeListener("SIGTERM", primary.onSigterm);
	});

	test("readEcsEnv reads every MIDDY_ECS_* key and ignores the rest", () => {
		deepStrictEqual(
			readEcsEnv({
				MIDDY_ECS_ACCOUNTID: "123",
				MIDDY_ECS_REGION: "us-east-1",
				MIDDY_ECS_TASKARN: "arn:aws:ecs:us-east-1:123:task/cluster/abc",
				MIDDY_ECS_FAMILY: "svc",
				MIDDY_ECS_REVISION: "7",
				MIDDY_ECS_OTHER: "x",
			}),
			{
				accountId: "123",
				region: "us-east-1",
				taskArn: "arn:aws:ecs:us-east-1:123:task/cluster/abc",
				family: "svc",
				revision: "7",
			},
		);
	});

	test("fetchEcsMetadata skips the request when no metadata URI is set", async () => {
		const urls = [];
		const meta = await fetchEcsMetadata(undefined, async (url) => {
			urls.push(url);
			return { ok: true, json: async () => ({ Family: "fam" }) };
		});
		deepStrictEqual(meta, {});
		deepStrictEqual(urls, []);
	});

	test("fetchEcsMetadata requests the task endpoint under the metadata URI and maps every field", async () => {
		const urls = [];
		const meta = await fetchEcsMetadata(
			"http://169.254.170.2/v4/abc",
			async (url) => {
				urls.push(url);
				return {
					ok: true,
					json: async () => ({
						TaskARN: "arn:aws:ecs:us-east-1:111:task/cluster/abc",
						Family: "fam",
						Revision: 7,
					}),
				};
			},
		);
		deepStrictEqual(urls, ["http://169.254.170.2/v4/abc/task"]);
		deepStrictEqual(meta, {
			accountId: "111",
			region: "us-east-1",
			taskArn: "arn:aws:ecs:us-east-1:111:task/cluster/abc",
			family: "fam",
			revision: "7",
		});
	});

	test("fetchEcsMetadata ignores the body of a non-ok response", async () => {
		const meta = await fetchEcsMetadata("http://x", async () => ({
			ok: false,
			json: async () => ({
				TaskARN: "arn:aws:ecs:us-east-1:111:task/cluster/abc",
				Family: "fam",
				Revision: 7,
			}),
		}));
		deepStrictEqual(meta, {});
	});

	test("runPrimary publishes each known task metadata field and leaves unknown ones unset", async () => {
		const cluster = makeFakeCluster();
		const withMeta = (task) => async () => ({
			ok: true,
			json: async () => task,
		});
		clearEcsEnv();
		process.env.ECS_CONTAINER_METADATA_URI_V4 = "http://meta";
		try {
			const full = await runPrimary(
				{ workers: 0 },
				{
					cluster,
					fetch: withMeta({
						TaskARN: "arn:aws:ecs:us-east-1:222:task/cluster/abc",
						Family: "fam",
						Revision: 3,
					}),
				},
			);
			process.removeListener("SIGTERM", full.onSigterm);
			deepStrictEqual(readEcsEnv(), {
				accountId: "222",
				region: "us-east-1",
				taskArn: "arn:aws:ecs:us-east-1:222:task/cluster/abc",
				family: "fam",
				revision: "3",
			});
			clearEcsEnv();
			const partial = await runPrimary(
				{ workers: 0 },
				{ cluster, fetch: withMeta({ Family: "fam" }) },
			);
			process.removeListener("SIGTERM", partial.onSigterm);
			// process.env stringifies assignments, so an unknown field has to be
			// skipped rather than written as the string "undefined".
			deepStrictEqual(readEcsEnv(), { family: "fam" });
		} finally {
			delete process.env.ECS_CONTAINER_METADATA_URI_V4;
			clearEcsEnv();
		}
	});

	test("runWorker composes invokedFunctionArn only when region, account and family are all known", async () => {
		const cases = [
			[
				{
					MIDDY_ECS_REGION: "us-west-2",
					MIDDY_ECS_ACCOUNTID: "999",
					MIDDY_ECS_FAMILY: "svc",
				},
				"arn:aws:ecs:us-west-2:999:service/svc",
			],
			[{}, undefined],
			[{ MIDDY_ECS_ACCOUNTID: "999", MIDDY_ECS_FAMILY: "svc" }, undefined],
			[{ MIDDY_ECS_REGION: "us-west-2", MIDDY_ECS_FAMILY: "svc" }, undefined],
			[
				{ MIDDY_ECS_REGION: "us-west-2", MIDDY_ECS_ACCOUNTID: "999" },
				undefined,
			],
		];
		try {
			for (const [env, expected] of cases) {
				clearEcsEnv();
				Object.assign(process.env, env);
				let captured;
				const { onSigterm, loopPromise } = await runWorker(
					{
						handler: async (_event, context) => {
							captured = context;
							return { batchItemFailures: [] };
						},
						poller: stubPoller([{ Records: [1] }]),
						timeout: 1000,
						gracefulShutdownMs: 1000,
					},
					{ exit: noop },
				);
				await loopPromise;
				process.removeListener("SIGTERM", onSigterm);
				strictEqual(captured.invokedFunctionArn, expected, JSON.stringify(env));
			}
		} finally {
			clearEcsEnv();
		}
	});

	test("runPollLoop survives handler and acknowledge failures without an onError", async () => {
		let acked = 0;
		const poller = {
			source: "test",
			async *poll() {
				yield { Records: [1] };
				yield { Records: [2] };
			},
			async acknowledge(event) {
				if (event.Records[0] === 2) throw new Error("ack-fail");
				acked++;
			},
		};
		let calls = 0;
		await runPollLoop({
			poller,
			handler: async () => {
				calls++;
				if (calls === 1) throw new Error("boom");
				return { batchItemFailures: [] };
			},
			timeout: 1000,
			signal: new AbortController().signal,
		});
		strictEqual(calls, 2);
		strictEqual(acked, 0);
	});

	test("drainAndExit cancels the deadline timer once the loop has drained", async () => {
		// A live deadline timer would keep the worker alive for the whole
		// gracefulShutdownMs budget after exitImpl returned.
		const ac = new AbortController();
		const loopPromise = new Promise((r) =>
			ac.signal.addEventListener("abort", () => r()),
		);
		const before = pendingTimeouts();
		let exited;
		await drainAndExit({
			abortController: ac,
			loopPromise,
			gracefulShutdownMs: 60_000,
			exitImpl: (code) => {
				exited = code;
			},
		});
		strictEqual(exited, 0);
		strictEqual(pendingTimeouts(), before);
	});

	test("runPrimary resets the re-fork backoff at exactly 60 s since the previous exit", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const { onSigterm } = await runPrimary(
			{ workers: 1 },
			{ cluster, fetch: noMeta },
		);
		process.removeListener("SIGTERM", onSigterm);
		cluster.crash(1);
		t.mock.timers.tick(1000);
		strictEqual(cluster.forks, 2);
		// The healthy window is measured from the previous exit, not the re-fork.
		t.mock.timers.tick(59_000);
		cluster.crash(2);
		t.mock.timers.tick(999);
		strictEqual(cluster.forks, 2);
		t.mock.timers.tick(1);
		strictEqual(cluster.forks, 3);
	});

	// --- pollSqs: options, request shape and delete batching --------------------

	const sqsQueueUrl = "https://sqs.us-east-1.amazonaws.com/111/q";

	// Records every command the poller sends (name, input, send options) and
	// answers with `respond(commandName, callNumber)`.
	const makeCapturingClient = (respond) => {
		const calls = [];
		return {
			calls,
			send: async (cmd, opts) => {
				calls.push({ name: cmd.constructor.name, input: cmd.input, opts });
				return respond(cmd.constructor.name, calls.length);
			},
		};
	};

	test("pollSqsValidateOptions reports the package and checks every option", () => {
		throws(
			() => pollSqsValidateOptions({}),
			(err) => {
				strictEqual(err.cause.package, "@middy/ecs-batch/pollSqs");
				return true;
			},
		);
		const accepted = [
			{},
			{ client: { send: noop } },
			{ maxNumberOfMessages: 1 },
			{ maxNumberOfMessages: 10 },
			{ waitTimeSeconds: 0 },
			{ waitTimeSeconds: 20 },
			{ visibilityTimeout: 0 },
			{ eventSourceArn: "arn:aws:sqs:us-east-1:111:q" },
			{ awsRegion: "us-east-1" },
		];
		for (const extra of accepted) {
			pollSqsValidateOptions({ queueUrl: sqsQueueUrl, ...extra });
		}
		const rejected = [
			{ queueUrl: 1 },
			{ client: "sqs" },
			{ maxNumberOfMessages: 0 },
			{ maxNumberOfMessages: 11 },
			{ maxNumberOfMessages: "5" },
			{ waitTimeSeconds: -1 },
			{ waitTimeSeconds: 21 },
			{ waitTimeSeconds: 1.5 },
			{ visibilityTimeout: -1 },
			{ eventSourceArn: 1 },
			{ awsRegion: 1 },
			{ foo: "bar" },
		];
		for (const extra of rejected) {
			throws(
				() => pollSqsValidateOptions({ queueUrl: sqsQueueUrl, ...extra }),
				TypeError,
				JSON.stringify(extra),
			);
		}
	});

	test("pollSqs validates its options on construction", () => {
		throws(() => pollSqs({}), TypeError);
	});

	test("pollSqs sends ReceiveMessage with the documented defaults, the configured overrides and the abort signal", async () => {
		const cases = [
			[{}, { MaxNumberOfMessages: 10, WaitTimeSeconds: 20 }],
			[
				{ maxNumberOfMessages: 5, waitTimeSeconds: 0 },
				{ MaxNumberOfMessages: 5, WaitTimeSeconds: 0 },
			],
			[
				{ maxNumberOfMessages: 1, waitTimeSeconds: 5, visibilityTimeout: 30 },
				{ MaxNumberOfMessages: 1, WaitTimeSeconds: 5, VisibilityTimeout: 30 },
			],
			[
				{ visibilityTimeout: 0 },
				{ MaxNumberOfMessages: 10, WaitTimeSeconds: 20, VisibilityTimeout: 0 },
			],
		];
		for (const [options, expected] of cases) {
			const ac = new AbortController();
			const client = makeCapturingClient(() => {
				ac.abort();
				return { Messages: [] };
			});
			await pollSqs({ queueUrl: sqsQueueUrl, client, ...options })
				.poll(ac.signal)
				.next();
			deepStrictEqual(
				client.calls,
				[
					{
						name: "ReceiveMessageCommand",
						input: {
							QueueUrl: sqsQueueUrl,
							AttributeNames: ["All"],
							MessageAttributeNames: ["All"],
							...expected,
						},
						opts: { abortSignal: ac.signal },
					},
				],
				JSON.stringify(options),
			);
		}
	});

	test("pollSqs derives eventSourceARN and awsRegion from the queue URL only when every part is present", async () => {
		const cases = [
			[
				"https://sqs.us-east-2.amazonaws.com/123456789012/my-queue",
				"arn:aws:sqs:us-east-2:123456789012:my-queue",
				"us-east-2",
			],
			["https://sqs/123456789012/my-queue", undefined, undefined],
			["https://sqs.us-east-2.amazonaws.com//my-queue", undefined, "us-east-2"],
			[
				"https://sqs.us-east-2.amazonaws.com/123456789012",
				undefined,
				"us-east-2",
			],
			["not-a-url", undefined, undefined],
		];
		const receiveOne = (ac) =>
			makeCapturingClient(() => {
				ac.abort();
				return { Messages: [{ MessageId: "m", ReceiptHandle: "r", Body: "" }] };
			});
		for (const [queueUrl, eventSourceARN, awsRegion] of cases) {
			const ac = new AbortController();
			const { value } = await pollSqs({ queueUrl, client: receiveOne(ac) })
				.poll(ac.signal)
				.next();
			strictEqual(value.Records[0].eventSourceARN, eventSourceARN, queueUrl);
			strictEqual(value.Records[0].awsRegion, awsRegion, queueUrl);
		}
		// Explicit options win over anything derived from the URL.
		const ac = new AbortController();
		const { value } = await pollSqs({
			queueUrl: cases[0][0],
			eventSourceArn: "arn:aws:sqs:eu-west-1:999:other",
			awsRegion: "eu-west-1",
			client: receiveOne(ac),
		})
			.poll(ac.signal)
			.next();
		strictEqual(
			value.Records[0].eventSourceARN,
			"arn:aws:sqs:eu-west-1:999:other",
		);
		strictEqual(value.Records[0].awsRegion, "eu-west-1");
	});

	test("pollSqs.acknowledge sends one DeleteMessageBatch per ten records", async () => {
		for (const [count, batches] of [
			[1, 1],
			[10, 1],
			[11, 2],
			[20, 2],
		]) {
			const client = makeCapturingClient(() => ({}));
			const Records = Array.from({ length: count }, (_, i) => ({
				messageId: `m${i}`,
				receiptHandle: `rh${i}`,
			}));
			await pollSqs({ queueUrl: sqsQueueUrl, client }).acknowledge(
				{ Records },
				{ batchItemFailures: [] },
			);
			strictEqual(client.calls.length, batches, `${count} records`);
			deepStrictEqual(client.calls[0], {
				name: "DeleteMessageBatchCommand",
				input: {
					QueueUrl: sqsQueueUrl,
					Entries: Records.slice(0, 10).map((r, i) => ({
						Id: String(i),
						ReceiptHandle: r.receiptHandle,
					})),
				},
				opts: undefined,
			});
		}
	});

	// --- pollKinesis: options, request shape and polling cadence ----------------

	const kinesisBase = { streamName: "s", shardId: "0" };
	const oneKinesisRecord = {
		PartitionKey: "p",
		SequenceNumber: "1",
		Data: "x",
	};

	test("pollKinesisValidateOptions reports the package and checks every option", () => {
		throws(
			() => pollKinesisValidateOptions({}),
			(err) => {
				strictEqual(err.cause.package, "@middy/ecs-batch/pollKinesis");
				return true;
			},
		);
		const accepted = [
			{},
			{ streamArn: "arn:aws:kinesis:us-east-1:111:stream/s" },
			{ client: { send: noop } },
			{ shardIteratorType: "AT_SEQUENCE_NUMBER" },
			{ shardIteratorType: "AFTER_SEQUENCE_NUMBER" },
			{ shardIteratorType: "TRIM_HORIZON" },
			{ shardIteratorType: "LATEST" },
			{ shardIteratorType: "AT_TIMESTAMP" },
			{
				startingSequenceNumber:
					"49590338271490256608559692538361571095921575989136588898",
			},
			{ timestamp: 1_700_000_000 },
			{ limit: 1 },
			{ limit: 10_000 },
			{ pollingDelay: 0 },
			{ awsRegion: "us-east-1" },
		];
		for (const extra of accepted) {
			pollKinesisValidateOptions({ ...kinesisBase, ...extra });
		}
		const rejected = [
			{ streamName: undefined },
			{ shardId: undefined },
			{ streamArn: 1 },
			{ client: "kinesis" },
			{ shardIteratorType: "AT_OFFSET" },
			{ shardIteratorType: 1 },
			{ startingSequenceNumber: 1 },
			{ timestamp: "2024-01-01" },
			{ limit: 0 },
			{ limit: 10_001 },
			{ limit: "1" },
			{ pollingDelay: -1 },
			{ awsRegion: 1 },
			{ foo: "bar" },
		];
		for (const extra of rejected) {
			throws(
				() => pollKinesisValidateOptions({ ...kinesisBase, ...extra }),
				TypeError,
				JSON.stringify(extra),
			);
		}
	});

	test("pollKinesis validates its options on construction", () => {
		throws(() => pollKinesis({}), TypeError);
	});

	test("pollKinesis sends GetShardIterator and GetRecords with the documented defaults and the abort signal", async () => {
		const ac = new AbortController();
		const client = makeCapturingClient((name) =>
			name === "GetShardIteratorCommand"
				? { ShardIterator: "it-1" }
				: { NextShardIterator: null, Records: [oneKinesisRecord] },
		);
		await pollKinesis({ ...kinesisBase, client })
			.poll(ac.signal)
			.next();
		deepStrictEqual(client.calls, [
			{
				name: "GetShardIteratorCommand",
				input: {
					StreamName: "s",
					ShardId: "0",
					ShardIteratorType: "LATEST",
					StartingSequenceNumber: undefined,
					Timestamp: undefined,
				},
				opts: { abortSignal: ac.signal },
			},
			{
				name: "GetRecordsCommand",
				input: { ShardIterator: "it-1", Limit: 1000 },
				opts: { abortSignal: ac.signal },
			},
		]);
	});

	test("pollKinesis forwards shardIteratorType, startingSequenceNumber, timestamp and limit", async () => {
		const ac = new AbortController();
		const client = makeCapturingClient((name) =>
			name === "GetShardIteratorCommand"
				? { ShardIterator: "it-1" }
				: { NextShardIterator: null, Records: [oneKinesisRecord] },
		);
		await pollKinesis({
			...kinesisBase,
			client,
			shardIteratorType: "AT_TIMESTAMP",
			startingSequenceNumber: "42",
			timestamp: 1_700_000_000,
			limit: 25,
		})
			.poll(ac.signal)
			.next();
		deepStrictEqual(client.calls[0].input, {
			StreamName: "s",
			ShardId: "0",
			ShardIteratorType: "AT_TIMESTAMP",
			StartingSequenceNumber: "42",
			Timestamp: 1_700_000_000,
		});
		deepStrictEqual(client.calls[1].input, {
			ShardIterator: "it-1",
			Limit: 25,
		});
	});

	// --- pollDynamoDBStreams: options and request shape -------------------------

	const ddbBase = {
		streamArn: "arn:aws:dynamodb:us-east-1:111:table/t/stream/2024",
		shardId: "0",
	};
	const oneDdbRecord = {
		eventID: "e",
		eventName: "INSERT",
		dynamodb: { SequenceNumber: "1" },
	};

	test("pollDynamoDBStreamsValidateOptions reports the package and checks every option", () => {
		throws(
			() => pollDynamoDBStreamsValidateOptions({}),
			(err) => {
				strictEqual(err.cause.package, "@middy/ecs-batch/pollDynamoDBStreams");
				return true;
			},
		);
		const accepted = [
			{},
			{ client: { send: noop } },
			{ shardIteratorType: "AT_SEQUENCE_NUMBER" },
			{ shardIteratorType: "AFTER_SEQUENCE_NUMBER" },
			{ shardIteratorType: "TRIM_HORIZON" },
			{ shardIteratorType: "LATEST" },
			{ sequenceNumber: "111" },
			{ limit: 1 },
			{ limit: 1000 },
			{ pollingDelay: 0 },
			{ awsRegion: "us-east-1" },
		];
		for (const extra of accepted) {
			pollDynamoDBStreamsValidateOptions({ ...ddbBase, ...extra });
		}
		const rejected = [
			{ streamArn: undefined },
			{ shardId: undefined },
			{ client: "ddb" },
			{ shardIteratorType: "AT_TIMESTAMP" },
			{ shardIteratorType: 1 },
			{ sequenceNumber: 111 },
			{ limit: 0 },
			{ limit: 1001 },
			{ limit: "1" },
			{ pollingDelay: -1 },
			{ awsRegion: 1 },
			{ foo: "bar" },
		];
		for (const extra of rejected) {
			throws(
				() => pollDynamoDBStreamsValidateOptions({ ...ddbBase, ...extra }),
				TypeError,
				JSON.stringify(extra),
			);
		}
	});

	test("pollDynamoDBStreams validates its options on construction", () => {
		// shardId is only read inside poll(), so a missing one is caught by the
		// validator alone.
		throws(
			() => pollDynamoDBStreams({ streamArn: ddbBase.streamArn }),
			(err) => {
				strictEqual(err.cause.package, "@middy/ecs-batch/pollDynamoDBStreams");
				return true;
			},
		);
	});

	test("pollDynamoDBStreams sends GetShardIterator and GetRecords with the documented defaults and the abort signal", async () => {
		const ac = new AbortController();
		const client = makeCapturingClient((name) =>
			name === "GetShardIteratorCommand"
				? { ShardIterator: "it-1" }
				: { NextShardIterator: null, Records: [oneDdbRecord] },
		);
		await pollDynamoDBStreams({ ...ddbBase, client })
			.poll(ac.signal)
			.next();
		deepStrictEqual(client.calls, [
			{
				name: "GetShardIteratorCommand",
				input: {
					StreamArn: ddbBase.streamArn,
					ShardId: "0",
					ShardIteratorType: "LATEST",
					SequenceNumber: undefined,
				},
				opts: { abortSignal: ac.signal },
			},
			{
				name: "GetRecordsCommand",
				input: { ShardIterator: "it-1", Limit: 1000 },
				opts: { abortSignal: ac.signal },
			},
		]);
	});

	test("pollDynamoDBStreams forwards shardIteratorType, sequenceNumber and limit", async () => {
		const ac = new AbortController();
		const client = makeCapturingClient((name) =>
			name === "GetShardIteratorCommand"
				? { ShardIterator: "it-1" }
				: { NextShardIterator: null, Records: [oneDdbRecord] },
		);
		await pollDynamoDBStreams({
			...ddbBase,
			client,
			shardIteratorType: "AT_SEQUENCE_NUMBER",
			sequenceNumber: "42",
			limit: 25,
		})
			.poll(ac.signal)
			.next();
		deepStrictEqual(client.calls[0].input, {
			StreamArn: ddbBase.streamArn,
			ShardId: "0",
			ShardIteratorType: "AT_SEQUENCE_NUMBER",
			SequenceNumber: "42",
		});
		deepStrictEqual(client.calls[1].input, {
			ShardIterator: "it-1",
			Limit: 25,
		});
	});

	// --- stream pollers: polling cadence on an empty shard ----------------------

	// Answers every GetRecords with no records and aborts on the `abortAt`th call.
	const makeEmptyStreamClient = (ac, abortAt) => {
		const client = {
			records: 0,
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				client.records++;
				if (client.records >= abortAt) ac.abort();
				return { NextShardIterator: "i", Records: [] };
			},
		};
		return client;
	};

	const streamPollers = [
		["pollKinesis", (opts) => pollKinesis({ ...kinesisBase, ...opts })],
		[
			"pollDynamoDBStreams",
			(opts) => pollDynamoDBStreams({ ...ddbBase, ...opts }),
		],
	];

	for (const [name, make] of streamPollers) {
		test(`${name} polls again without a timer when pollingDelay is 0`, async () => {
			const ac = new AbortController();
			const client = makeEmptyStreamClient(ac, 3);
			const done = make({ pollingDelay: 0, client }).poll(ac.signal).next();
			await settleMacrotask();
			// All three GetRecords calls ran back to back, with no timer in between.
			strictEqual(client.records, 3);
			strictEqual((await done).done, true);
		});

		test(`${name} waits pollingDelay between empty GetRecords calls`, async (t) => {
			t.mock.timers.enable({ apis: ["setTimeout"] });
			const ac = new AbortController();
			const client = makeEmptyStreamClient(ac, 50);
			const done = make({ pollingDelay: 40, client }).poll(ac.signal).next();
			await settleMacrotask();
			strictEqual(client.records, 1, "the second call waits for the delay");
			t.mock.timers.tick(39);
			await settleMacrotask();
			strictEqual(client.records, 1, "not before pollingDelay has elapsed");
			t.mock.timers.tick(1);
			await settleMacrotask();
			strictEqual(client.records, 2, "one call per elapsed delay");
			t.mock.timers.tick(60);
			await settleMacrotask();
			strictEqual(client.records, 3, "three calls 100 ms in, not fifty");
			ok(
				client.records >= 2 && client.records < 50,
				`${client.records} calls after 100 ms`,
			);
			ac.abort();
			// The loop is parked in its delay; the next tick lets it see the abort.
			t.mock.timers.tick(40);
			strictEqual((await done).done, true);
		});
	}

	// --- pollKafka: options, subscription and connection reuse ------------------

	const kafkaBase = { brokers: ["b1"], groupId: "g", topics: ["t"] };

	test("pollKafkaValidateOptions reports the package and checks every option", () => {
		throws(
			() => pollKafkaValidateOptions({}),
			(err) => {
				strictEqual(err.cause.package, "@middy/ecs-batch/pollKafka");
				return true;
			},
		);
		const accepted = [
			{},
			{ clientId: "svc" },
			{ fromBeginning: true },
			{ client: { consumer: noop } },
			{ consumer: { run: noop } },
			{ ssl: true },
			{ ssl: false },
			{ eventSourceArn: "arn:aws:kafka:us-east-1:111:cluster/c/1" },
			{ selfManaged: true },
			{ heartbeatIntervalMs: 1 },
		];
		for (const extra of accepted) {
			pollKafkaValidateOptions({ ...kafkaBase, ...extra });
		}
		const rejected = [
			{ brokers: undefined },
			{ brokers: "b1" },
			{ brokers: [1] },
			{ groupId: undefined },
			{ groupId: 1 },
			{ topics: undefined },
			{ topics: [1] },
			{ clientId: 1 },
			{ fromBeginning: "yes" },
			{ client: "kafka" },
			{ consumer: "c" },
			{ ssl: "yes" },
			{ eventSourceArn: 1 },
			{ selfManaged: 1 },
			{ heartbeatIntervalMs: 0 },
			{ heartbeatIntervalMs: 1.5 },
			{ foo: "bar" },
		];
		for (const extra of rejected) {
			throws(
				() => pollKafkaValidateOptions({ ...kafkaBase, ...extra }),
				TypeError,
				JSON.stringify(extra),
			);
		}
	});

	test("pollKafka validates its options on construction", () => {
		throws(() => pollKafka({}), TypeError);
	});

	test("pollKafka subscribes to every topic from the latest offset by default", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({ ...kafkaBase, topics: ["t1", "t2"], consumer });
		const ac = new AbortController();
		const { firstNext } = await drainKafkaSetup(poller.poll(ac.signal));
		deepStrictEqual(consumer.subscriptions, [
			{ topic: "t1", fromBeginning: false },
			{ topic: "t2", fromBeginning: false },
		]);
		ac.abort();
		strictEqual((await firstNext).done, true);
	});

	test("pollKafka connects and subscribes once across repeated poll() calls", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({ ...kafkaBase, consumer });
		for (let i = 0; i < 2; i++) {
			const ac = new AbortController();
			const { firstNext } = await drainKafkaSetup(poller.poll(ac.signal));
			ac.abort();
			strictEqual((await firstNext).done, true);
		}
		strictEqual(consumer.connectCalled, 1);
		strictEqual(consumer.subscriptions.length, 1);
		strictEqual(consumer.disconnectCalled, 2);
	});

	// --- pollAmq: options, subscription and record mapping ----------------------

	const amqBase = {
		connectOptions: { host: "localhost", port: 61613 },
		destination: "/queue/orders",
	};

	// STOMP MESSAGE frame double; `encodings` records what readString was asked for.
	const stompFrame = (headers, body, encodings = []) => ({
		headers,
		readString(encoding, cb) {
			encodings.push(encoding);
			cb(null, body);
		},
	});

	test("pollAmqValidateOptions reports the package and checks every option", () => {
		throws(
			() => pollAmqValidateOptions({}),
			(err) => {
				strictEqual(err.cause.package, "@middy/ecs-batch/pollAmq");
				return true;
			},
		);
		const accepted = [
			{},
			{ ackMode: "client" },
			{ ackMode: "client-individual" },
			{ batchSize: 1 },
			{ batchWindowMs: 0 },
			{ client: { subscribe: noop } },
			{ connect: noop },
			{ eventSourceArn: "arn:aws:mq:us-east-2:111:broker:b:1" },
		];
		for (const extra of accepted) {
			pollAmqValidateOptions({ ...amqBase, ...extra });
		}
		const rejected = [
			{ connectOptions: undefined },
			{ connectOptions: "localhost" },
			{ destination: undefined },
			{ destination: 1 },
			{ ackMode: "auto" },
			{ ackMode: 1 },
			{ batchSize: 0 },
			{ batchSize: "1" },
			{ batchWindowMs: -1 },
			{ client: "stomp" },
			{ connect: "fn" },
			{ eventSourceArn: 1 },
			{ foo: "bar" },
		];
		for (const extra of rejected) {
			throws(
				() => pollAmqValidateOptions({ ...amqBase, ...extra }),
				TypeError,
				JSON.stringify(extra),
			);
		}
	});

	test("pollAmq validates its options on construction", () => {
		throws(() => pollAmq({}), TypeError);
	});

	test("pollAmq subscribes with client-individual acks by default and disconnects on abort", async () => {
		for (const [extra, ack] of [
			[{}, "client-individual"],
			[{ ackMode: "client" }, "client"],
		]) {
			const stomp = makeFakeStompClient();
			const poller = pollAmq({ ...amqBase, client: stomp, ...extra });
			strictEqual(poller.source, "aws:amq");
			const ac = new AbortController();
			const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
			deepStrictEqual(stomp.subscriptions, [
				{ destination: "/queue/orders", ack },
			]);
			ac.abort();
			strictEqual((await firstNext).done, true);
			strictEqual(stomp.disconnectCalls, 1);
		}
	});

	test("pollAmq reads each frame body as utf-8", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({ ...amqBase, batchSize: 1, client: stomp });
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		const encodings = [];
		stomp.subscribeCb()(
			null,
			stompFrame({ "message-id": "m1" }, "héllo", encodings),
		);
		const { value } = await firstNext;
		deepStrictEqual(encodings, ["utf-8"]);
		strictEqual(
			value.messages[0].data,
			Buffer.from("héllo", "utf-8").toString("base64"),
		);
		ac.abort();
	});

	test("pollAmq maps every STOMP header and keeps only JMS user properties", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({ ...amqBase, batchSize: 1, client: stomp });
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		stomp.subscribeCb()(
			null,
			stompFrame(
				{
					"message-id": "m1",
					destination: "/queue/orders",
					"correlation-id": "corr-1",
					expires: "0",
					"reply-to": "/queue/replies",
					priority: "9",
					redelivered: "true",
					timestamp: "1700000000000",
					type: "OrderCreated",
					subscription: "sub-0",
					browser: "false",
					JMSXUserID: "user",
					"original-destination": "/queue/original",
					persistent: "true",
					ack: "m1",
					"content-length": "1",
					"content-type": "text/plain",
					transformation: "jms-map-json",
					"transformation-error": "none",
					"amq-msg-type": "jms/bytes-message",
					receipt: "r1",
					transaction: "tx1",
					index: "1",
					myCustomProperty: "value",
				},
				"x",
			),
		);
		const { value } = await firstNext;
		deepStrictEqual(value.messages[0], {
			messageID: "m1",
			messageType: "jms/bytes-message",
			deliveryMode: 2,
			replyTo: "/queue/replies",
			type: "OrderCreated",
			expiration: "0",
			priority: 9,
			correlationID: "corr-1",
			redelivered: true,
			destination: { physicalName: "orders" },
			data: Buffer.from("x").toString("base64"),
			timestamp: 1700000000000,
			properties: { index: "1", myCustomProperty: "value" },
		});
		ac.abort();
	});

	test("pollAmq strips every STOMP destination prefix down to the physical name", async () => {
		const cases = [
			["/queue/orders", "orders"],
			["/topic/events", "events"],
			["/temp-queue/tmp", "tmp"],
			["/temp-topic/tmp", "tmp"],
			["/remote-temp-queue/tmp", "tmp"],
			["/remote-temp-topic/tmp", "tmp"],
			["/queue/a/queue/b", "a/queue/b"],
			// Only a leading prefix is stripped; one further in is part of the name.
			["orders/queue/x", "orders/queue/x"],
		];
		for (const [destination, physicalName] of cases) {
			const stomp = makeFakeStompClient();
			const poller = pollAmq({
				...amqBase,
				destination,
				batchSize: 1,
				client: stomp,
			});
			const ac = new AbortController();
			const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
			stomp.subscribeCb()(
				null,
				stompFrame({ "message-id": "m", destination }, "x"),
			);
			const { value } = await firstNext;
			deepStrictEqual(
				value.messages[0].destination,
				{ physicalName },
				destination,
			);
			ac.abort();
		}
	});

	test("pollAmq.acknowledge settles each message once", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({
			...amqBase,
			batchSize: 2,
			batchWindowMs: 5000,
			client: stomp,
		});
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		stomp.subscribeCb()(null, stompFrame({ "message-id": "m1" }, "a"));
		stomp.subscribeCb()(null, stompFrame({ "message-id": "m2" }, "b"));
		const { value } = await firstNext;
		const response = { batchItemFailures: [{ itemIdentifier: "m2" }] };
		await poller.acknowledge(value, response);
		await poller.acknowledge(value, response);
		deepStrictEqual(
			stomp.acked.map((m) => m.headers["message-id"]),
			["m1"],
		);
		deepStrictEqual(
			stomp.nacked.map((m) => m.headers["message-id"]),
			["m2"],
		);
		ac.abort();
	});

	// --- pollRmq: options, channel setup and acknowledgement --------------------

	test("pollRmqValidateOptions reports the package and checks every option", () => {
		throws(
			() => pollRmqValidateOptions({}),
			(err) => {
				strictEqual(err.cause.package, "@middy/ecs-batch/pollRmq");
				return true;
			},
		);
		const accepted = [
			{},
			{ url: "amqp://localhost" },
			{ vhost: "/" },
			{ prefetch: 1 },
			{ batchSize: 1 },
			{ batchWindowMs: 0 },
			{ connection: { createChannel: noop } },
			{ channel: { consume: noop } },
			{ connect: noop },
			{ eventSourceArn: "arn:aws:mq:us-east-2:111:broker:b:1" },
		];
		for (const extra of accepted) {
			pollRmqValidateOptions({ queue: "q", ...extra });
		}
		const rejected = [
			{ queue: undefined },
			{ queue: 1 },
			{ url: 1 },
			{ vhost: 1 },
			{ prefetch: 0 },
			{ prefetch: "1" },
			{ prefetch: 1.5 },
			{ batchSize: 0 },
			{ batchWindowMs: -1 },
			{ connection: "c" },
			{ channel: "ch" },
			{ connect: "fn" },
			{ eventSourceArn: 1 },
			{ foo: "bar" },
		];
		for (const extra of rejected) {
			throws(
				() => pollRmqValidateOptions({ queue: "q", ...extra }),
				TypeError,
				JSON.stringify(extra),
			);
		}
	});

	test("pollRmq validates its options on construction", () => {
		throws(() => pollRmq({}), TypeError);
	});

	test("pollRmq prefetches twice the batch size unless configured and consumes with manual acks", async () => {
		for (const [extra, prefetch] of [
			[{}, 20],
			[{ batchSize: 3 }, 6],
			[{ batchSize: 3, prefetch: 7 }, 7],
		]) {
			const channel = makeFakeRmqChannel();
			const connection = makeFakeRmqConnection(channel);
			const poller = pollRmq({
				queue: "orders",
				connection,
				channel,
				...extra,
			});
			strictEqual(poller.source, "aws:rmq");
			const ac = new AbortController();
			const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
			deepStrictEqual(channel.prefetches, [prefetch], JSON.stringify(extra));
			deepStrictEqual(channel.consumes, [
				{ queue: "orders", opts: { noAck: false } },
			]);
			strictEqual(connection.createChannelCalls, 0, "injected channel reused");
			ac.abort();
			strictEqual((await firstNext).done, true);
			await settleMacrotask();
			strictEqual(channel.closeCalls, 1);
			strictEqual(connection.closeCalls, 1);
		}
	});

	// "If the consumer is cancelled by RabbitMQ, the message callback will be
	// invoked with null." https://amqp-node.github.io/amqplib/channel_api.html#channel_consume
	test("pollRmq fails the poll when RabbitMQ cancels the consumer", async () => {
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			connection: makeFakeRmqConnection(channel),
			channel,
		});
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		channel.consumeCb()(null);
		await rejects(firstNext, (err) => {
			strictEqual(err.message, "Consumer cancelled by RabbitMQ");
			deepStrictEqual(err.cause, {
				package: "@middy/ecs-batch/pollRmq",
				data: { queue: "q" },
			});
			return true;
		});
		ac.abort();
	});

	test("pollRmq closes the connection when the poll fails, even if the channel close fails", async () => {
		const channel = makeFakeRmqChannel();
		channel.close = async () => {
			throw new Error("Channel closed");
		};
		const connection = makeFakeRmqConnection(channel);
		const poller = pollRmq({ queue: "q", connection, channel });
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		channel.consumeCb()(null);
		await rejects(firstNext, { message: "Consumer cancelled by RabbitMQ" });
		strictEqual(connection.closeCalls, 1);
		strictEqual(getEventListeners(ac.signal, "abort").length, 0);
	});

	// A channel emits "close" when it or its connection closes, after "error"
	// when the server closed it with one.
	// https://amqp-node.github.io/amqplib/channel_api.html#channel-events
	test("pollRmq fails the poll when the channel or its connection closes", async () => {
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			connection: makeFakeRmqConnection(channel),
			channel,
		});
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		channel.emit("close");
		await rejects(firstNext, (err) => {
			strictEqual(err.message, "Channel closed");
			deepStrictEqual(err.cause, {
				package: "@middy/ecs-batch/pollRmq",
				data: { queue: "q" },
			});
			return true;
		});
		ac.abort();
	});

	test("pollRmq fails the poll with the error the channel was closed with", async () => {
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			connection: makeFakeRmqConnection(channel),
			channel,
		});
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		const closeError = new Error("Channel closed by server: 404 (NOT-FOUND)");
		channel.emit("error", closeError);
		channel.emit("close");
		await rejects(firstNext, (err) => err === closeError);
		ac.abort();
	});

	test("pollRmq raises a close that lands while a batch is in flight without settling the batch", async () => {
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			connection: makeFakeRmqConnection(channel),
			channel,
			batchSize: 1,
			batchWindowMs: 5,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainPollSetup(it);
		channel.consumeCb()({
			fields: { deliveryTag: 1 },
			properties: {},
			content: Buffer.from("a"),
		});
		await firstNext;
		channel.emit("close");
		// The closed channel already requeued the delivery; settling it on the
		// dead channel would throw over the reason the poll failed.
		await rejects(it.next(), { message: "Channel closed" });
		deepStrictEqual(channel.nacked, []);
		ac.abort();
	});

	test("pollRmq.acknowledge requeues each failed delivery on its own and settles each message once", async () => {
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			connection: makeFakeRmqConnection(channel),
			channel,
			batchSize: 2,
			batchWindowMs: 5000,
		});
		const ac = new AbortController();
		const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
		const msg = (tag) => ({
			fields: { deliveryTag: tag },
			properties: {},
			content: Buffer.from(`b${tag}`),
		});
		channel.consumeCb()(msg(1));
		channel.consumeCb()(msg(2));
		const { value } = await firstNext;
		const response = { batchItemFailures: [{ itemIdentifier: "2" }] };
		await poller.acknowledge(value, response);
		await poller.acknowledge(value, response);
		deepStrictEqual(
			channel.acked.map((m) => m.fields.deliveryTag),
			[1],
		);
		deepStrictEqual(
			channel.nacked.map((m) => m.fields.deliveryTag),
			[2],
		);
		// nack(msg, allUpTo = false, requeue = true): only this delivery goes back.
		deepStrictEqual(channel.nackArgs, [[false, true]]);
		ac.abort();
	});

	// --- broker pollers: shared batching contract -------------------------------
	// `deliver(n)` pushes n messages through the fake broker; `bodies(event)`
	// lists the delivered bodies in order.

	const brokerPollers = [
		{
			name: "pollAmq",
			make(opts) {
				const stomp = makeFakeStompClient();
				const poller = pollAmq({ ...amqBase, client: stomp, ...opts });
				let n = 0;
				return {
					poller,
					deliver(count) {
						for (let i = 0; i < count; i++) {
							n++;
							stomp.subscribeCb()(
								null,
								stompFrame({ "message-id": `m${n}` }, `body-${n}`),
							);
						}
					},
					bodies: (event) =>
						event.messages.map((m) => Buffer.from(m.data, "base64").toString()),
				};
			},
		},
		{
			name: "pollRmq",
			make(opts) {
				const channel = makeFakeRmqChannel();
				const poller = pollRmq({
					queue: "q",
					connection: makeFakeRmqConnection(channel),
					channel,
					...opts,
				});
				let n = 0;
				return {
					poller,
					deliver(count) {
						for (let i = 0; i < count; i++) {
							n++;
							channel.consumeCb()({
								fields: { deliveryTag: n },
								properties: {},
								content: Buffer.from(`body-${n}`),
							});
						}
					},
					bodies: (event) =>
						event.rmqMessagesByQueue["q::/"].map((r) =>
							Buffer.from(r.data, "base64").toString(),
						),
				};
			},
		},
	];

	const idle = Symbol("idle");
	const within = (promise, ms) =>
		Promise.race([promise, sleep(ms).then(() => idle)]);
	// Under mock timers: whether `promise` has settled by now.
	const settledOr = (promise) =>
		Promise.race([promise, settleMacrotask().then(() => idle)]);
	// The broker pollers sleep in 50 ms steps while a window is open; advance the
	// mocked clock the same way, letting each step's continuation run. Pending
	// continuations (a delivery waking the loop) run before the first tick so the
	// window they open starts at the current time.
	const advance = async (t, ms) => {
		await settleMacrotask();
		for (let elapsed = 0; elapsed < ms; elapsed += 50) {
			t.mock.timers.tick(Math.min(50, ms - elapsed));
			await settleMacrotask();
		}
	};

	for (const { name, make } of brokerPollers) {
		test(`${name} yields a full batch without waiting for the window`, async () => {
			const { poller, deliver, bodies } = make({
				batchSize: 2,
				batchWindowMs: 5000,
			});
			const ac = new AbortController();
			const it = poller.poll(ac.signal);
			const { firstNext } = await drainPollSetup(it);
			deliver(3);
			const first = await within(firstNext, 300);
			notStrictEqual(first, idle, "yielded within 300 ms");
			deepStrictEqual(bodies(first.value), ["body-1", "body-2"]);
			await poller.acknowledge(first.value, { batchItemFailures: [] });
			ac.abort();
			strictEqual((await it.next()).done, true);
		});

		test(`${name} yields a partial batch when the window closes and keeps the rest for the next one`, async () => {
			const { poller, deliver, bodies } = make({
				batchSize: 10,
				batchWindowMs: 1,
			});
			const ac = new AbortController();
			const it = poller.poll(ac.signal);
			const { firstNext } = await drainPollSetup(it);
			deliver(1);
			// A 1 ms window closes long before the 50 ms poll tick would.
			const first = await within(firstNext, 40);
			notStrictEqual(first, idle, "yielded within 40 ms");
			deepStrictEqual(bodies(first.value), ["body-1"]);
			await poller.acknowledge(first.value, { batchItemFailures: [] });
			deliver(1);
			const second = await within(it.next(), 40);
			notStrictEqual(second, idle, "second batch yielded within 40 ms");
			deepStrictEqual(bodies(second.value), ["body-2"]);
			ac.abort();
		});

		test(`${name} yields at the next poll tick once a batch fills mid-window`, async (t) => {
			t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
			const { poller, deliver, bodies } = make({
				batchSize: 2,
				batchWindowMs: 5000,
			});
			const ac = new AbortController();
			const it = poller.poll(ac.signal);
			const { firstNext } = await drainPollSetup(it);
			deliver(1);
			await advance(t, 60);
			strictEqual(await settledOr(firstNext), idle, "one message, window open");
			deliver(1);
			strictEqual(await settledOr(firstNext), idle, "full, next tick pending");
			await advance(t, 50);
			const first = await settledOr(firstNext);
			notStrictEqual(first, idle, "yielded at the next 50 ms tick");
			deepStrictEqual(bodies(first.value), ["body-1", "body-2"]);
			ac.abort();
		});

		test(`${name} does not yield while nothing is pending`, async (t) => {
			t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
			const { poller } = make({ batchSize: 1, batchWindowMs: 20 });
			const ac = new AbortController();
			const it = poller.poll(ac.signal);
			const { firstNext } = await drainPollSetup(it);
			await advance(t, 100);
			strictEqual(await settledOr(firstNext), idle);
			ac.abort();
			strictEqual((await firstNext).done, true);
		});

		test(`${name} batches ten messages by default`, async () => {
			const { poller, deliver, bodies } = make({});
			const ac = new AbortController();
			const it = poller.poll(ac.signal);
			const { firstNext } = await drainPollSetup(it);
			deliver(11);
			const first = await within(firstNext, 300);
			notStrictEqual(first, idle, "a full default batch is yielded at once");
			deepStrictEqual(
				bodies(first.value),
				Array.from({ length: 10 }, (_, i) => `body-${i + 1}`),
			);
			ac.abort();
		});

		test(`${name} holds a partial batch for the default window`, async (t) => {
			t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
			const { poller, deliver, bodies } = make({ batchSize: 2 });
			const ac = new AbortController();
			const it = poller.poll(ac.signal);
			const { firstNext } = await drainPollSetup(it);
			deliver(1);
			await advance(t, 100);
			strictEqual(await settledOr(firstNext), idle, "held at 100 ms");
			await advance(t, 899);
			strictEqual(await settledOr(firstNext), idle, "held at 999 ms");
			await advance(t, 1);
			const first = await settledOr(firstNext);
			notStrictEqual(first, idle, "yielded when the 1000 ms window closed");
			deepStrictEqual(bodies(first.value), ["body-1"]);
			ac.abort();
		});

		test(`${name} yields whatever is pending at once when batchWindowMs is 0`, async (t) => {
			// With the clock frozen the window's deadline equals "now" for the whole
			// test, so a window that closes at the deadline yields immediately while
			// one that stays open through it would never yield.
			t.mock.timers.enable({ apis: ["Date"] });
			const { poller, deliver, bodies } = make({
				batchSize: 2,
				batchWindowMs: 0,
			});
			const ac = new AbortController();
			const it = poller.poll(ac.signal);
			const { firstNext } = await drainPollSetup(it);
			deliver(1);
			try {
				const first = await within(firstNext, 100);
				notStrictEqual(first, idle, "yielded without waiting");
				deepStrictEqual(bodies(first.value), ["body-1"]);
			} finally {
				ac.abort();
			}
		});
	}

	// --- runPollLoop: a throwing onError must not stop the loop ------------------

	test("runPollLoop keeps polling when onError throws on a handler failure", async () => {
		// onError is user code (a logger, an APM client). If it throws, the loop
		// must carry on to the next batch instead of rejecting and taking the
		// worker down with it.
		const poller = stubPoller([{ Records: [1] }, { Records: [2] }]);
		const seen = [];
		let calls = 0;
		await runPollLoop({
			poller,
			handler: async () => {
				calls++;
				if (calls === 1) throw new Error("boom");
				return { batchItemFailures: [] };
			},
			timeout: 1000,
			signal: new AbortController().signal,
			onError: (err, event) => {
				seen.push({ err, event });
				throw new Error("logger down");
			},
		});
		strictEqual(calls, 2);
		strictEqual(seen.length, 1);
		strictEqual(seen[0].err.message, "boom");
		deepStrictEqual(seen[0].event, { Records: [1] });
		// The second batch was handled and acknowledged as usual.
		deepStrictEqual(
			poller.acked.map((a) => a.event),
			[{ Records: [2] }],
		);
	});

	test("runPollLoop keeps polling when onError throws on an acknowledge failure", async () => {
		const acked = [];
		const poller = {
			source: "test",
			async *poll() {
				yield { Records: [1] };
				yield { Records: [2] };
			},
			async acknowledge(event) {
				if (event.Records[0] === 1) throw new Error("ack-fail");
				acked.push(event);
			},
		};
		const seen = [];
		let calls = 0;
		await runPollLoop({
			poller,
			handler: async () => {
				calls++;
				return { batchItemFailures: [] };
			},
			timeout: 1000,
			signal: new AbortController().signal,
			onError: (err) => {
				seen.push(err.message);
				throw new Error("logger down");
			},
		});
		strictEqual(calls, 2);
		deepStrictEqual(seen, ["ack-fail"]);
		deepStrictEqual(acked, [{ Records: [2] }]);
	});

	// --- pollKafka: consumer crashes ---------------------------------------------
	// kafkajs restarts the consumer itself after a retriable crash and emits
	// consumer.events.CRASH with `restart: true`. A non-retriable one (SASL
	// authentication, authorization) is emitted with `restart: false` and the
	// consumer stays stopped, so the poll loop would otherwise park forever.

	const kafkaCrash = (
		consumer,
		restart,
		message = "SASL authentication failed",
	) => {
		const error = new Error(message);
		consumer.emit(consumer.events.CRASH, { error, groupId: "g", restart });
		return error;
	};

	test("pollKafka throws a non-retriable consumer crash from poll() and disconnects", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({ ...kafkaBase, consumer });
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const error = kafkaCrash(consumer, false);
		const outcome = await within(
			firstNext.then(
				() => "yielded",
				(e) => e,
			),
			200,
		);
		strictEqual(outcome, error);
		strictEqual(consumer.disconnectCalled, 1);
	});

	test("pollKafka stays parked through a retriable consumer crash", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({ ...kafkaBase, consumer });
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		kafkaCrash(consumer, true, "KafkaJSNumberOfRetriesExceeded");
		strictEqual(await within(firstNext, 30), idle, "still parked");
		// kafkajs restarted the consumer and delivers the next batch as usual.
		const { payload } = makeKafkaBatchPayload(kafkaBatchOf("1"));
		const eachBatchPromise = consumer.runHandler()(payload);
		const { value } = await firstNext;
		deepStrictEqual(Object.keys(value.records), ["t1-0"]);
		await poller.acknowledge(value, { batchItemFailures: [] });
		await eachBatchPromise;
		ac.abort();
		strictEqual((await it.next()).done, true);
	});

	test("pollKafka throws a non-retriable crash that lands while the handler holds a batch", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({ ...kafkaBase, consumer });
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const { calls, payload } = makeKafkaBatchPayload(kafkaBatchOf("1"));
		const eachBatchPromise = consumer.runHandler()(payload);
		const { value } = await firstNext;
		const error = kafkaCrash(consumer, false);
		// The batch already handed over is still acknowledged and committed.
		await poller.acknowledge(value, { batchItemFailures: [] });
		await eachBatchPromise;
		deepStrictEqual(calls.resolved, ["1"]);
		const outcome = await within(
			it.next().then(
				() => "yielded",
				(e) => e,
			),
			200,
		);
		strictEqual(outcome, error);
		strictEqual(consumer.disconnectCalled, 1);
	});

	test("runWorker reports a non-retriable Kafka crash through onError and exits 1", async () => {
		const consumer = makeFakeKafkaConsumer();
		const errors = [];
		const exits = [];
		const { onSigterm } = await runWorker(
			{
				handler: async () => ({ batchItemFailures: [] }),
				poller: pollKafka({ ...kafkaBase, consumer }),
				timeout: 1000,
				gracefulShutdownMs: 1000,
				onError: (err, event) => errors.push({ err, event }),
			},
			{ exit: (code) => exits.push(code) },
		);
		for (let i = 0; i < 8; i++) await Promise.resolve();
		const error = kafkaCrash(consumer, false);
		await settleMacrotask();
		process.removeListener("SIGTERM", onSigterm);
		deepStrictEqual(errors, [{ err: error, event: undefined }]);
		deepStrictEqual(exits, [1]);
	});

	// --- batchItemFailures entries that invalidate the whole response -----------
	// Lambda treats a response with an empty-string, null or unknown
	// itemIdentifier as a failure of the whole batch: every record is retried.
	// https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
	// https://docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html

	const invalidBatchItemFailures = [
		[null],
		[{}],
		[{ itemIdentifier: null }],
		[{ itemIdentifier: "" }],
		[{ itemIdentifier: "not-in-batch" }],
	];

	const expectInvalidBatchFailure = (err, pkgName, itemIdentifier) => {
		strictEqual(err.message, "Invalid batchItemFailures entry");
		deepStrictEqual(err.cause, {
			package: pkgName,
			data: { itemIdentifier },
		});
		return true;
	};

	test("pollSqs.acknowledge deletes nothing and raises when an entry does not identify a record", async () => {
		for (const batchItemFailures of invalidBatchItemFailures) {
			const client = makeCapturingClient(() => ({}));
			const poller = pollSqs({
				queueUrl: "https://sqs.us-east-1.amazonaws.com/111/q",
				client,
			});
			const event = {
				Records: [
					{ messageId: "m1", receiptHandle: "rh1" },
					{ messageId: "m2", receiptHandle: "rh2" },
				],
			};
			await rejects(
				() => poller.acknowledge(event, { batchItemFailures }),
				(err) =>
					expectInvalidBatchFailure(
						err,
						"@middy/ecs-batch/pollSqs",
						batchItemFailures[0]?.itemIdentifier,
					),
			);
			deepStrictEqual(client.calls, [], JSON.stringify(batchItemFailures));
		}
	});

	test("pollKafka.acknowledge commits nothing and raises when an entry does not identify a record", async () => {
		const cases = [
			...invalidBatchItemFailures,
			[{ itemIdentifier: { partition: "t1-0", offset: 99 } }],
			[{ itemIdentifier: { partition: "other-0", offset: 1 } }],
		];
		for (const batchItemFailures of cases) {
			const consumer = makeFakeKafkaConsumer();
			const poller = pollKafka({ retryDelayMs: 0, ...kafkaBase, consumer });
			const ac = new AbortController();
			const it = poller.poll(ac.signal);
			const { firstNext } = await drainKafkaSetup(it);
			const { calls, payload } = makeKafkaBatchPayload(kafkaBatchOf("1", "2"));
			const eachBatchPromise = consumer.runHandler()(payload);
			const { value } = await firstNext;
			await rejects(
				() => poller.acknowledge(value, { batchItemFailures }),
				(err) =>
					expectInvalidBatchFailure(
						err,
						"@middy/ecs-batch/pollKafka",
						batchItemFailures[0]?.itemIdentifier,
					),
			);
			// The gate is released with every record failed so eachBatch returns
			// and kafkajs fetches the batch again from the last committed offset.
			await eachBatchPromise;
			deepStrictEqual(calls.resolved, [], JSON.stringify(batchItemFailures));
			deepStrictEqual(calls.commits, [], JSON.stringify(batchItemFailures));
			ac.abort();
			await it.next();
		}
	});

	test("pollKafka.acknowledge raises before any batch when the entry identifies no record", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({ ...kafkaBase, consumer });
		await rejects(
			() =>
				poller.acknowledge(undefined, {
					batchItemFailures: [{ itemIdentifier: "t1-0-1" }],
				}),
			(err) =>
				expectInvalidBatchFailure(err, "@middy/ecs-batch/pollKafka", "t1-0-1"),
		);
	});

	test("pollAmq.acknowledge nacks every message and raises when an entry does not identify a record", async () => {
		for (const batchItemFailures of invalidBatchItemFailures) {
			const stomp = makeFakeStompClient();
			const poller = pollAmq({
				...amqBase,
				batchSize: 2,
				batchWindowMs: 5000,
				client: stomp,
			});
			const ac = new AbortController();
			const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
			stomp.subscribeCb()(null, stompFrame({ "message-id": "m1" }, "a"));
			stomp.subscribeCb()(null, stompFrame({ "message-id": "m2" }, "b"));
			const { value } = await firstNext;
			await rejects(
				() => poller.acknowledge(value, { batchItemFailures }),
				(err) =>
					expectInvalidBatchFailure(
						err,
						"@middy/ecs-batch/pollAmq",
						batchItemFailures[0]?.itemIdentifier,
					),
			);
			deepStrictEqual(stomp.acked, [], JSON.stringify(batchItemFailures));
			deepStrictEqual(
				stomp.nacked.map((m) => m.headers["message-id"]),
				["m1", "m2"],
				JSON.stringify(batchItemFailures),
			);
			// The batch is settled: a second acknowledge finds nothing to do.
			await poller.acknowledge(value, { batchItemFailures: [] });
			strictEqual(stomp.acked.length, 0);
			ac.abort();
		}
	});

	test("pollRmq.acknowledge requeues every delivery and raises when an entry does not identify a record", async () => {
		for (const batchItemFailures of invalidBatchItemFailures) {
			const channel = makeFakeRmqChannel();
			const poller = pollRmq({
				queue: "q",
				connection: makeFakeRmqConnection(channel),
				channel,
				batchSize: 2,
				batchWindowMs: 5000,
			});
			const ac = new AbortController();
			const { firstNext } = await drainPollSetup(poller.poll(ac.signal));
			for (const tag of [1, 2]) {
				channel.consumeCb()({
					fields: { deliveryTag: tag },
					properties: {},
					content: Buffer.from(`b${tag}`),
				});
			}
			const { value } = await firstNext;
			await rejects(
				() => poller.acknowledge(value, { batchItemFailures }),
				(err) =>
					expectInvalidBatchFailure(
						err,
						"@middy/ecs-batch/pollRmq",
						batchItemFailures[0]?.itemIdentifier,
					),
			);
			deepStrictEqual(channel.acked, [], JSON.stringify(batchItemFailures));
			deepStrictEqual(
				channel.nacked.map((m) => m.fields.deliveryTag),
				[1, 2],
				JSON.stringify(batchItemFailures),
			);
			deepStrictEqual(channel.nackArgs, [
				[false, true],
				[false, true],
			]);
			ac.abort();
		}
	});

	// --- pollSqs: region and ARN from every documented queue URL form -----------
	// Endpoint hostnames per
	// https://docs.aws.amazon.com/general/latest/gr/sqs-service.html (standard,
	// api.aws, FIPS and the legacy <region>.queue.amazonaws.com forms) and the
	// interface VPC endpoint form vpce-<id>.sqs.<region>.vpce.amazonaws.com.

	const receiveOneSqs = (ac, config) => {
		const client = makeCapturingClient(() => {
			ac.abort();
			return { Messages: [{ MessageId: "m", ReceiptHandle: "r", Body: "" }] };
		});
		if (config) client.config = config;
		return client;
	};

	test("pollSqs derives the region and ARN from VPC endpoint, FIPS, api.aws, China and legacy queue URLs", async () => {
		// The ARN partition follows the region: aws-cn for China, aws-us-gov for
		// GovCloud. https://docs.aws.amazon.com/IAM/latest/UserGuide/reference-arns.html
		const cases = [
			[
				"https://vpce-0123456789abcdef0-abcdefgh.sqs.us-east-1.vpce.amazonaws.com/123456789012/orders",
				"us-east-1",
				"aws",
			],
			[
				"https://sqs-fips.us-gov-west-1.amazonaws.com/123456789012/orders",
				"us-gov-west-1",
				"aws-us-gov",
			],
			["https://sqs.us-east-2.api.aws/123456789012/orders", "us-east-2", "aws"],
			[
				"https://sqs.cn-north-1.amazonaws.com.cn/123456789012/orders",
				"cn-north-1",
				"aws-cn",
			],
			[
				"https://us-east-2.queue.amazonaws.com/123456789012/orders",
				"us-east-2",
				"aws",
			],
			[
				"https://sqs.eu-west-3.amazonaws.com:443/123456789012/orders",
				"eu-west-3",
				"aws",
			],
		];
		for (const [queueUrl, region, partition] of cases) {
			const ac = new AbortController();
			const { value } = await pollSqs({ queueUrl, client: receiveOneSqs(ac) })
				.poll(ac.signal)
				.next();
			strictEqual(value.Records[0].awsRegion, region, queueUrl);
			strictEqual(
				value.Records[0].eventSourceARN,
				`arn:${partition}:sqs:${region}:123456789012:orders`,
				queueUrl,
			);
		}
	});

	test("pollSqs falls back to the client's region when the queue URL carries none", async () => {
		// The bare legacy us-east-1 host and custom endpoints (LocalStack, a
		// private DNS name) have no region in the hostname.
		for (const queueUrl of [
			"https://queue.amazonaws.com/123456789012/orders",
			"http://localhost:4566/123456789012/orders",
		]) {
			const ac = new AbortController();
			let asked = 0;
			const client = receiveOneSqs(ac, {
				region: async () => {
					asked++;
					return "eu-central-1";
				},
			});
			const { value } = await pollSqs({ queueUrl, client })
				.poll(ac.signal)
				.next();
			strictEqual(value.Records[0].awsRegion, "eu-central-1", queueUrl);
			strictEqual(
				value.Records[0].eventSourceARN,
				"arn:aws:sqs:eu-central-1:123456789012:orders",
				queueUrl,
			);
			strictEqual(asked, 1, "resolved once per poller");
		}
	});

	test("pollSqs prefers the region in the queue URL over the client's", async () => {
		const ac = new AbortController();
		const client = receiveOneSqs(ac, { region: async () => "eu-central-1" });
		const { value } = await pollSqs({
			queueUrl: "https://sqs.us-west-2.amazonaws.com/123456789012/orders",
			client,
		})
			.poll(ac.signal)
			.next();
		strictEqual(value.Records[0].awsRegion, "us-west-2");
		strictEqual(
			value.Records[0].eventSourceARN,
			"arn:aws:sqs:us-west-2:123456789012:orders",
		);
	});

	test("pollSqs treats only a hostname whose first label is the region as a legacy endpoint", async () => {
		// The legacy form is exactly <region>.queue.amazonaws.com. A custom
		// endpoint that merely ends in that suffix is not one, so its region comes
		// from the client rather than from the hostname.
		const ac = new AbortController();
		const client = receiveOneSqs(ac, { region: async () => "eu-central-1" });
		const { value } = await pollSqs({
			queueUrl:
				"https://proxy.us-east-1.queue.amazonaws.com/123456789012/orders",
			client,
		})
			.poll(ac.signal)
			.next();
		strictEqual(value.Records[0].awsRegion, "eu-central-1");
		strictEqual(
			value.Records[0].eventSourceARN,
			"arn:aws:sqs:eu-central-1:123456789012:orders",
		);
	});

	test("pollSqs ignores a region in a hostname that only ends in an AWS-looking label", async () => {
		// Both endpoint patterns have to match to the end of the hostname:
		// otherwise an unrelated domain that prefixes an AWS one dictates the
		// region, and with it the partition the ARN is built in.
		for (const queueUrl of [
			"https://sqs.us-east-1.amazonaws.com.example.org/123456789012/orders",
			"https://us-east-1.queue.amazonaws.com.example.org/123456789012/orders",
			"https://sqs.cn-north-1.example.org/123456789012/orders",
		]) {
			const ac = new AbortController();
			const client = receiveOneSqs(ac, { region: async () => "eu-central-1" });
			const { value } = await pollSqs({ queueUrl, client })
				.poll(ac.signal)
				.next();
			strictEqual(value.Records[0].awsRegion, "eu-central-1", queueUrl);
			strictEqual(
				value.Records[0].eventSourceARN,
				"arn:aws:sqs:eu-central-1:123456789012:orders",
				queueUrl,
			);
		}
	});

	test("pollSqs leaves the region and ARN unset when neither the queue URL nor the client carries one", async () => {
		// A custom client may expose a config without the SDK's region resolver;
		// that must not throw, and no ARN can be composed without a region.
		const ac = new AbortController();
		const client = receiveOneSqs(ac, {});
		const { value } = await pollSqs({
			queueUrl: "https://queue.amazonaws.com/123456789012/orders",
			client,
		})
			.poll(ac.signal)
			.next();
		strictEqual(value.Records[0].awsRegion, undefined);
		strictEqual(value.Records[0].eventSourceARN, undefined);
	});

	// --- pollKinesis: region from the client when no ARN is configured ---------

	test("pollKinesis falls back to the client's region when streamArn and awsRegion are omitted", async () => {
		const client = {
			config: { region: async () => "eu-north-1" },
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return { NextShardIterator: null, Records: [oneKinesisRecord] };
			},
		};
		const { value } = await pollKinesis({ ...kinesisBase, client })
			.poll(new AbortController().signal)
			.next();
		strictEqual(value.Records[0].awsRegion, "eu-north-1");
		strictEqual(value.Records[0].eventSourceARN, undefined);
	});

	test("pollKinesis prefers the region in streamArn over the client's", async () => {
		const streamArn = "arn:aws:kinesis:ap-southeast-2:111:stream/events";
		const client = {
			config: { region: async () => "eu-north-1" },
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return { NextShardIterator: null, Records: [oneKinesisRecord] };
			},
		};
		const { value } = await pollKinesis({ ...kinesisBase, streamArn, client })
			.poll(new AbortController().signal)
			.next();
		strictEqual(value.Records[0].awsRegion, "ap-southeast-2");
		strictEqual(value.Records[0].eventSourceARN, streamArn);
	});

	test("pollKinesis leaves awsRegion unset when the client carries no region resolver", async () => {
		// A custom client may expose a config without the SDK's region resolver;
		// that must not throw.
		const client = {
			config: {},
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return { NextShardIterator: null, Records: [oneKinesisRecord] };
			},
		};
		const { value } = await pollKinesis({ ...kinesisBase, client })
			.poll(new AbortController().signal)
			.next();
		strictEqual(value.Records[0].awsRegion, undefined);
		strictEqual(value.Records[0].eventSourceARN, undefined);
	});

	// --- stream checkpointing and queue release --------------------------------

	// A shard whose iterators are record positions: GetShardIterator seeks to
	// the named sequence number (or the start), GetRecords returns every record
	// from the iterator's position onward.
	const makeFakeShard = (seqs, toRecord, seqParam) => {
		const sent = [];
		return {
			sent,
			send: async (cmd) => {
				sent.push(cmd);
				// A poller that never redelivers spins on the drained shard.
				if (sent.length > 20) throw new Error("runaway poll");
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					const seq = cmd.input[seqParam];
					return {
						ShardIterator: String(seq === undefined ? 0 : seqs.indexOf(seq)),
					};
				}
				const pos = Number(cmd.input.ShardIterator);
				const read = seqs.slice(pos, pos + cmd.input.Limit);
				return {
					NextShardIterator: String(pos + read.length),
					Records: read.map(toRecord),
				};
			},
		};
	};

	const kinesisShard = (seqs) =>
		makeFakeShard(
			seqs,
			(seq) => ({ PartitionKey: "p", SequenceNumber: seq, Data: "" }),
			"StartingSequenceNumber",
		);
	const kinesisSeqs = (event) =>
		event.Records.map((r) => r.kinesis.sequenceNumber);

	// Runs the loop until `responses` is exhausted; a function entry throws.
	const deliver = async (poller, toSeqs, responses) => {
		const ac = new AbortController();
		const deliveries = [];
		const errors = [];
		await runPollLoop({
			poller,
			timeout: 1000,
			signal: ac.signal,
			onError: (err) => errors.push(err),
			handler: async (event) => {
				deliveries.push(toSeqs(event));
				const response = responses[deliveries.length - 1];
				if (deliveries.length === responses.length) ac.abort();
				if (typeof response === "function") return response();
				return response;
			},
		});
		return { deliveries, errors };
	};
	const boom = () => {
		throw new Error("boom");
	};

	test("pollKinesis redelivers the batch from its first record when the handler throws", async () => {
		const client = kinesisShard(["1", "2", "3"]);
		const poller = pollKinesis({
			retryDelayMs: 0,
			streamName: "s",
			shardId: "0",
			pollingDelay: 0,
			client,
		});
		const { deliveries } = await deliver(poller, kinesisSeqs, [boom, {}]);
		deepStrictEqual(deliveries, [
			["1", "2", "3"],
			["1", "2", "3"],
		]);
		const seek = client.sent.filter(
			(c) => c.constructor.name === "GetShardIteratorCommand",
		)[1];
		strictEqual(seek.input.ShardIteratorType, "AT_SEQUENCE_NUMBER");
		strictEqual(seek.input.StartingSequenceNumber, "1");
	});

	const seeks = (client) =>
		client.sent
			.filter((c) => c.constructor.name === "GetShardIteratorCommand")
			.map((c) => c.input.StartingSequenceNumber ?? c.input.SequenceNumber);

	test("pollKinesis re-reads from the lowest failed sequence number on a partial batch failure", async () => {
		const client = kinesisShard(["1", "2", "3"]);
		const poller = pollKinesis({
			retryDelayMs: 0,
			streamName: "s",
			shardId: "0",
			pollingDelay: 0,
			client,
		});
		const { deliveries, errors } = await deliver(poller, kinesisSeqs, [
			{ batchItemFailures: [{ itemIdentifier: "3" }, { itemIdentifier: "2" }] },
			{},
		]);
		deepStrictEqual(deliveries, [
			["1", "2", "3"],
			["2", "3"],
		]);
		deepStrictEqual(seeks(client), [undefined, "2"]);
		strictEqual(errors.length, 0);
	});

	test("pollKinesis advances past a fully successful batch without seeking", async () => {
		const client = kinesisShard(["1", "2", "3"]);
		const poller = pollKinesis({
			streamName: "s",
			shardId: "0",
			pollingDelay: 1,
			client,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { value } = await it.next();
		await poller.acknowledge(value, { batchItemFailures: [] });
		// The next read starts where the batch ended, so the drained shard
		// returns nothing and the poller waits out pollingDelay.
		const next = it.next();
		await settleMacrotask();
		ac.abort();
		strictEqual((await next).done, true);
		deepStrictEqual(seeks(client), [undefined]);
		strictEqual(client.sent.at(-1).input.ShardIterator, "3");
	});

	test("pollKinesis redelivers the whole batch and raises on an invalid batchItemFailures entry", async () => {
		const client = kinesisShard(["1", "2", "3"]);
		const poller = pollKinesis({
			retryDelayMs: 0,
			streamName: "s",
			shardId: "0",
			pollingDelay: 0,
			client,
		});
		const { deliveries, errors } = await deliver(poller, kinesisSeqs, [
			{ batchItemFailures: [{ itemIdentifier: "" }] },
			{},
		]);
		deepStrictEqual(deliveries, [
			["1", "2", "3"],
			["1", "2", "3"],
		]);
		strictEqual(errors.length, 1);
		strictEqual(errors[0].message, "Invalid batchItemFailures entry");
		deepStrictEqual(errors[0].cause, {
			package: "@middy/ecs-batch/pollKinesis",
			data: { itemIdentifier: "" },
		});
	});

	test("pollKinesis stops without seeking when a re-seek is aborted or the loop was aborted", async () => {
		const ac = new AbortController();
		let seekCalls = 0;
		const client = {
			send: async (cmd, { abortSignal }) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					seekCalls++;
					if (seekCalls === 1) return { ShardIterator: "0" };
					ac.abort();
					throw abortSignal.reason;
				}
				return {
					NextShardIterator: "1",
					Records: [{ PartitionKey: "p", SequenceNumber: "1", Data: "" }],
				};
			},
		};
		const poller = pollKinesis({
			retryDelayMs: 0,
			streamName: "s",
			shardId: "0",
			client,
		});
		const it = poller.poll(ac.signal);
		await it.next();
		strictEqual((await it.next()).done, true);
		strictEqual(seekCalls, 2);
	});

	test("pollKinesis rethrows a non-abort error from the re-seek", async () => {
		let seekCalls = 0;
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					seekCalls++;
					if (seekCalls === 1) return { ShardIterator: "0" };
					throw new Error("throttled");
				}
				return {
					NextShardIterator: "1",
					Records: [{ PartitionKey: "p", SequenceNumber: "1", Data: "" }],
				};
			},
		};
		const poller = pollKinesis({
			retryDelayMs: 0,
			streamName: "s",
			shardId: "0",
			client,
		});
		const it = poller.poll(new AbortController().signal);
		await it.next();
		await rejects(it.next(), /throttled/);
	});

	const dynamodbShard = (seqs) =>
		makeFakeShard(
			seqs,
			(seq) => ({
				eventID: seq,
				eventName: "INSERT",
				dynamodb: { SequenceNumber: seq },
			}),
			"SequenceNumber",
		);
	const dynamodbSeqs = (event) =>
		event.Records.map((r) => r.dynamodb.SequenceNumber);
	const dynamodbBase = {
		streamArn: "arn:aws:dynamodb:us-east-1:111:table/t/stream/1",
		shardId: "0",
		pollingDelay: 0,
		retryDelayMs: 0,
	};

	test("pollDynamoDBStreams redelivers the batch from its first record when the handler throws", async () => {
		const client = dynamodbShard(["1", "2", "3"]);
		const poller = pollDynamoDBStreams({ ...dynamodbBase, client });
		const { deliveries } = await deliver(poller, dynamodbSeqs, [boom, {}]);
		deepStrictEqual(deliveries, [
			["1", "2", "3"],
			["1", "2", "3"],
		]);
		const seek = client.sent.filter(
			(c) => c.constructor.name === "GetShardIteratorCommand",
		)[1];
		strictEqual(seek.input.ShardIteratorType, "AT_SEQUENCE_NUMBER");
		strictEqual(seek.input.SequenceNumber, "1");
		strictEqual(seek.input.StreamArn, dynamodbBase.streamArn);
		strictEqual(seek.input.ShardId, "0");
	});

	test("pollDynamoDBStreams re-reads from the lowest failed sequence number on a partial batch failure", async () => {
		const client = dynamodbShard(["1", "2", "3"]);
		const poller = pollDynamoDBStreams({ ...dynamodbBase, client });
		const { deliveries, errors } = await deliver(poller, dynamodbSeqs, [
			{ batchItemFailures: [{ itemIdentifier: "3" }, { itemIdentifier: "2" }] },
			{},
		]);
		deepStrictEqual(deliveries, [
			["1", "2", "3"],
			["2", "3"],
		]);
		deepStrictEqual(seeks(client), [undefined, "2"]);
		strictEqual(errors.length, 0);
	});

	test("pollDynamoDBStreams advances past a fully successful batch without seeking", async () => {
		const client = dynamodbShard(["1", "2", "3"]);
		const poller = pollDynamoDBStreams({
			...dynamodbBase,
			pollingDelay: 1,
			client,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { value } = await it.next();
		await poller.acknowledge(value, {});
		const next = it.next();
		await settleMacrotask();
		ac.abort();
		strictEqual((await next).done, true);
		deepStrictEqual(seeks(client), [undefined]);
		strictEqual(client.sent.at(-1).input.ShardIterator, "3");
	});

	test("pollDynamoDBStreams redelivers the whole batch and raises on an invalid batchItemFailures entry", async () => {
		const client = dynamodbShard(["1", "2", "3"]);
		const poller = pollDynamoDBStreams({ ...dynamodbBase, client });
		const { deliveries, errors } = await deliver(poller, dynamodbSeqs, [
			{ batchItemFailures: [{ itemIdentifier: null }] },
			{},
		]);
		deepStrictEqual(deliveries, [
			["1", "2", "3"],
			["1", "2", "3"],
		]);
		strictEqual(errors.length, 1);
		deepStrictEqual(errors[0].cause, {
			package: "@middy/ecs-batch/pollDynamoDBStreams",
			data: { itemIdentifier: null },
		});
	});

	const oneDynamodbRecord = {
		NextShardIterator: "1",
		Records: [{ eventID: "1", dynamodb: { SequenceNumber: "1" } }],
	};

	test("pollDynamoDBStreams stops when the re-seek is aborted", async () => {
		const ac = new AbortController();
		let seekCalls = 0;
		const client = {
			send: async (cmd, { abortSignal }) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					seekCalls++;
					if (seekCalls === 1) return { ShardIterator: "0" };
					ac.abort();
					throw abortSignal.reason;
				}
				return oneDynamodbRecord;
			},
		};
		const poller = pollDynamoDBStreams({ ...dynamodbBase, client });
		const it = poller.poll(ac.signal);
		await it.next();
		strictEqual((await it.next()).done, true);
		strictEqual(seekCalls, 2);
	});

	test("pollDynamoDBStreams rethrows a non-abort error from the re-seek", async () => {
		let seekCalls = 0;
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					seekCalls++;
					if (seekCalls === 1) return { ShardIterator: "0" };
					throw new Error("throttled");
				}
				return oneDynamodbRecord;
			},
		};
		const poller = pollDynamoDBStreams({ ...dynamodbBase, client });
		const it = poller.poll(new AbortController().signal);
		await it.next();
		await rejects(it.next(), /throttled/);
	});

	const rmqMessage = (tag) => ({
		fields: { deliveryTag: tag, redelivered: false },
		properties: {},
		content: Buffer.from("x"),
	});

	test("pollRmq requeues every delivery of a batch the handler threw on", async () => {
		const channel = makeFakeRmqChannel();
		const poller = pollRmq({
			queue: "q",
			batchSize: 2,
			connection: makeFakeRmqConnection(channel),
			channel,
		});
		const ac = new AbortController();
		const errors = [];
		const loop = runPollLoop({
			poller,
			timeout: 1000,
			signal: ac.signal,
			onError: (err) => errors.push(err),
			handler: boom,
		});
		for (let i = 0; i < 8; i++) await Promise.resolve();
		channel.consumeCb()(rmqMessage(1));
		channel.consumeCb()(rmqMessage(2));
		for (let i = 0; i < 16; i++) await settleMacrotask();
		deepStrictEqual(
			channel.nacked.map((m) => m.fields.deliveryTag),
			[1, 2],
		);
		deepStrictEqual(channel.nackArgs, [
			[false, true],
			[false, true],
		]);
		strictEqual(channel.acked.length, 0);
		strictEqual(errors.length, 1);
		ac.abort();
		await loop;
	});

	test("pollAmq nacks every message of a batch the handler threw on", async () => {
		const stomp = makeFakeStompClient();
		const poller = pollAmq({
			connectOptions: {},
			destination: "/queue/q",
			batchSize: 2,
			client: stomp,
		});
		const ac = new AbortController();
		const errors = [];
		const loop = runPollLoop({
			poller,
			timeout: 1000,
			signal: ac.signal,
			onError: (err) => errors.push(err),
			handler: boom,
		});
		for (let i = 0; i < 8; i++) await Promise.resolve();
		stomp.subscribeCb()(null, fakeStompMessage("id-1", "a"));
		stomp.subscribeCb()(null, fakeStompMessage("id-2", "b"));
		for (let i = 0; i < 16; i++) await settleMacrotask();
		deepStrictEqual(
			stomp.nacked.map((m) => m.headers["message-id"]),
			["id-1", "id-2"],
		);
		strictEqual(stomp.acked.length, 0);
		strictEqual(errors.length, 1);
		ac.abort();
		await loop;
	});

	test("ecsBatchRunner defaults gracefulShutdownMs to 25 s, inside ECS's default 30 s stopTimeout", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		const poller = {
			source: "test",
			async *poll() {
				yield { Records: [1] };
				// Never drains.
				await new Promise(noop);
			},
			acknowledge: noop,
		};
		const exits = [];
		const { onSigterm } = await ecsBatchRunner(
			{ handler: noop, poller },
			{ cluster: { isPrimary: false }, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		const drain = onSigterm();
		await settleMacrotask();
		t.mock.timers.tick(24_999);
		await settleMacrotask();
		deepStrictEqual(exits, []);
		t.mock.timers.tick(1);
		await drain;
		deepStrictEqual(exits, [1]);
	});

	// --- retry limits and backoff ----------------------------------------------

	test("pollKafka discards a batch past maxRetryAttempts, commits past it and reports it", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
			maxRetryAttempts: 1,
			retryDelayMs: 0,
		});
		const ac = new AbortController();
		const errors = [];
		const loop = runPollLoop({
			poller,
			handler: boom,
			timeout: 1000,
			signal: ac.signal,
			onError: (err) => errors.push(err),
		});
		await settleMacrotask();
		const uncommitted = {
			topics: [{ topic: "t1", partitions: [{ partition: 0, offset: "7" }] }],
		};
		// The first delivery and its one retry fail; the retry is the last.
		const first = makeKafkaBatchPayload(kafkaBatchOf("5", "6"), uncommitted);
		await consumer.runHandler()(first.payload);
		deepStrictEqual(first.calls.resolved, []);
		const retry = makeKafkaBatchPayload(kafkaBatchOf("5", "6"), uncommitted);
		await consumer.runHandler()(retry.payload);
		deepStrictEqual(retry.calls.resolved, ["5", "6"]);
		deepStrictEqual(retry.calls.commits, [uncommitted]);
		ac.abort();
		await loop;
		deepStrictEqual(
			errors.map((e) => e.message),
			["boom", "boom", "Retry attempts exhausted"],
		);
		deepStrictEqual(errors[2].cause, {
			package: "@middy/ecs-batch/pollKafka",
			data: {
				records: [
					{ topic: "t1", partition: 0, offset: 5 },
					{ topic: "t1", partition: 0, offset: 6 },
				],
			},
		});
	});

	// Drives one kafkajs eachBatch through a runPollLoop whose handler answers
	// with `respond(event)`; resolves with the payload's recorded calls.
	const kafkaRetryHarness = (options) => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
			...options,
		});
		const ac = new AbortController();
		const errors = [];
		let respond = boom;
		const loop = runPollLoop({
			poller,
			handler: async (event) => respond(event),
			timeout: 1000,
			signal: ac.signal,
			onError: (err) => errors.push(err),
		});
		return {
			errors,
			ac,
			loop,
			setResponse: (fn) => {
				respond = fn;
			},
			deliver: (...offsets) => {
				const batch = makeKafkaBatchPayload(kafkaBatchOf(...offsets));
				batch.done = consumer.runHandler()(batch.payload);
				return batch;
			},
		};
	};
	const kafkaFailures = (...offsets) => ({
		batchItemFailures: offsets.map((offset) => ({
			itemIdentifier: { partition: "t1-0", offset },
		})),
	});

	test("pollKafka backs off exponentially between retries of the same record, heartbeating meanwhile", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
		const h = kafkaRetryHarness({ retryDelayMs: 100, heartbeatIntervalMs: 40 });
		await settleMacrotask();
		for (const expected of [100, 200, 400]) {
			const batch = h.deliver("5");
			let settled = false;
			batch.done.then(() => {
				settled = true;
			});
			await settleMacrotask();
			t.mock.timers.tick(expected - 1);
			await settleMacrotask();
			strictEqual(settled, false, `still backing off before ${expected} ms`);
			t.mock.timers.tick(1);
			await batch.done;
			deepStrictEqual(batch.calls.resolved, []);
			ok(batch.calls.heartbeats >= 2);
		}
		h.ac.abort();
		await h.loop;
	});

	test("pollKafka caps the backoff at 30 s, or at retryDelayMs when larger", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		const waits = async (retryDelayMs, attempts) => {
			const h = kafkaRetryHarness({ retryDelayMs });
			await settleMacrotask();
			const out = [];
			for (let i = 0; i < attempts; i++) {
				const batch = h.deliver("5");
				let settled = false;
				batch.done.then(() => {
					settled = true;
				});
				let waited = 0;
				while (!settled) {
					await settleMacrotask();
					if (settled) break;
					t.mock.timers.tick(1000);
					waited += 1000;
				}
				out.push(waited);
			}
			h.ac.abort();
			await h.loop;
			return out;
		};
		deepStrictEqual(await waits(10_000, 4), [10_000, 20_000, 30_000, 30_000]);
		deepStrictEqual(await waits(40_000, 2), [40_000, 40_000]);
	});

	test("pollKafka stops backing off when shut down", async () => {
		const h = kafkaRetryHarness({ retryDelayMs: 60_000 });
		await settleMacrotask();
		const batch = h.deliver("5");
		await settleMacrotask();
		h.ac.abort();
		await batch.done;
		await h.loop;
		deepStrictEqual(batch.calls.resolved, []);
	});

	test("pollKafka counts retries per failed offset, so progress starts the count again", async () => {
		const h = kafkaRetryHarness({ maxRetryAttempts: 1, retryDelayMs: 0 });
		await settleMacrotask();
		h.setResponse(() => kafkaFailures(5));
		await h.deliver("5", "6").done;
		// 5 now succeeds and 6 fails: a first failure of 6, not a second retry.
		h.setResponse(() => kafkaFailures(6));
		const second = h.deliver("5", "6");
		await second.done;
		deepStrictEqual(second.calls.resolved, ["5"]);
		// A success clears the count for the partition.
		h.setResponse(() => ({ batchItemFailures: [] }));
		await h.deliver("6").done;
		h.setResponse(() => kafkaFailures(7));
		const fourth = h.deliver("7");
		await fourth.done;
		deepStrictEqual(fourth.calls.resolved, []);
		h.ac.abort();
		await h.loop;
		deepStrictEqual(h.errors, []);
	});

	test("pollKafka discards only the failed records of a partial failure past maxRetryAttempts", async () => {
		const h = kafkaRetryHarness({ maxRetryAttempts: 0, retryDelayMs: 0 });
		await settleMacrotask();
		h.setResponse(() => kafkaFailures(6));
		const batch = h.deliver("5", "6", "7");
		await batch.done;
		deepStrictEqual(batch.calls.resolved, ["5", "6", "7"]);
		h.ac.abort();
		await h.loop;
		strictEqual(h.errors.length, 1);
		deepStrictEqual(h.errors[0].cause.data, {
			records: [{ topic: "t1", partition: 0, offset: 6 }],
		});
	});

	test("pollKafka retries forever by default", async () => {
		const h = kafkaRetryHarness({ retryDelayMs: 0 });
		await settleMacrotask();
		for (let i = 0; i < 12; i++) {
			const batch = h.deliver("5");
			await batch.done;
			deepStrictEqual(batch.calls.resolved, []);
		}
		h.ac.abort();
		await h.loop;
		strictEqual(h.errors.length, 12);
	});

	test("pollKafkaValidateOptions bounds maxRetryAttempts to Lambda's -1..10000 and retryDelayMs to >= 0", () => {
		const base = { brokers: ["b"], groupId: "g", topics: ["t"] };
		pollKafkaValidateOptions({ ...base, maxRetryAttempts: -1 });
		pollKafkaValidateOptions({ ...base, maxRetryAttempts: 10000 });
		pollKafkaValidateOptions({ ...base, retryDelayMs: 0 });
		throws(() => pollKafkaValidateOptions({ ...base, maxRetryAttempts: -2 }));
		throws(() =>
			pollKafkaValidateOptions({ ...base, maxRetryAttempts: 10001 }),
		);
		throws(() => pollKafkaValidateOptions({ ...base, retryDelayMs: -1 }));
	});

	test("pollKinesis skips a batch past maxRetryAttempts and reports it", async () => {
		const client = kinesisShard(["1", "2", "3"]);
		const poller = pollKinesis({
			streamName: "s",
			shardId: "shard-0",
			pollingDelay: 0,
			limit: 1,
			maxRetryAttempts: 1,
			retryDelayMs: 0,
			client,
		});
		const { deliveries, errors } = await deliver(poller, kinesisSeqs, [
			boom,
			boom,
			{},
		]);
		deepStrictEqual(deliveries, [["1"], ["1"], ["2"]]);
		deepStrictEqual(
			errors.map((e) => e.message),
			["boom", "boom", "Retry attempts exhausted"],
		);
		deepStrictEqual(errors[2].cause, {
			package: "@middy/ecs-batch/pollKinesis",
			data: { shardId: "shard-0", sequenceNumbers: ["1"] },
		});
	});

	test("pollDynamoDBStreams skips a batch past maxRetryAttempts and reports it", async () => {
		const client = dynamodbShard(["1", "2", "3"]);
		const poller = pollDynamoDBStreams({
			...dynamodbBase,
			limit: 1,
			maxRetryAttempts: 0,
			client,
		});
		const { deliveries, errors } = await deliver(poller, dynamodbSeqs, [
			() => ({ batchItemFailures: [{ itemIdentifier: "1" }] }),
			{},
		]);
		deepStrictEqual(deliveries, [["1"], ["2"]]);
		deepStrictEqual(errors[0].cause, {
			package: "@middy/ecs-batch/pollDynamoDBStreams",
			data: { shardId: "0", sequenceNumbers: ["1"] },
		});
	});

	for (const [name, makePoller] of [
		[
			"pollKinesis",
			(client, opts) =>
				pollKinesis({ streamName: "s", shardId: "0", client, ...opts }),
		],
		[
			"pollDynamoDBStreams",
			(client, opts) =>
				pollDynamoDBStreams({
					streamArn: dynamodbBase.streamArn,
					shardId: "0",
					client,
					...opts,
				}),
		],
	]) {
		const shard = name === "pollKinesis" ? kinesisShard : dynamodbShard;

		test(`${name} backs off exponentially before re-reading a failed batch`, async (t) => {
			t.mock.timers.enable({ apis: ["setTimeout"] });
			const client = shard(["1"]);
			const poller = makePoller(client, { retryDelayMs: 100 });
			const it = poller.poll(new AbortController().signal);
			await it.next();
			for (const expected of [100, 200, 400]) {
				let settled = false;
				const next = it.next().then((r) => {
					settled = true;
					return r;
				});
				await settleMacrotask();
				t.mock.timers.tick(expected - 1);
				await settleMacrotask();
				strictEqual(settled, false, `still backing off before ${expected} ms`);
				t.mock.timers.tick(1);
				strictEqual((await next).done, false);
			}
			strictEqual(seeks(client).length, 4);
		});

		test(`${name} counts retries per sequence number and starts again after progress`, async () => {
			const client = shard(["1", "2"]);
			const poller = makePoller(client, {
				maxRetryAttempts: 1,
				retryDelayMs: 0,
				pollingDelay: 0,
			});
			const toSeqs = name === "pollKinesis" ? kinesisSeqs : dynamodbSeqs;
			const fail = (seq) => () => ({
				batchItemFailures: [{ itemIdentifier: seq }],
			});
			const { deliveries, errors } = await deliver(poller, toSeqs, [
				fail("1"),
				fail("2"),
				{},
			]);
			// 1 fails, then 2 fails: the second failure is 2's first, within the
			// one retry allowed, so nothing is discarded.
			deepStrictEqual(deliveries, [["1", "2"], ["1", "2"], ["2"]]);
			strictEqual(errors.length, 0);
		});

		test(`${name} discards without an onError when polled outside the runner`, async () => {
			const client = shard(["1", "2"]);
			const poller = makePoller(client, { maxRetryAttempts: 0, limit: 1 });
			const it = poller.poll(new AbortController().signal);
			await it.next();
			// Not acknowledged: the batch failed and has no retry left.
			const { value } = await it.next();
			const toSeqs = name === "pollKinesis" ? kinesisSeqs : dynamodbSeqs;
			deepStrictEqual(toSeqs(value), ["2"]);
			strictEqual(seeks(client).length, 1);
		});

		test(`${name} stops backing off when shut down`, async () => {
			const ac = new AbortController();
			const client = shard(["1"]);
			const poller = makePoller(client, { retryDelayMs: 60_000 });
			const it = poller.poll(ac.signal);
			await it.next();
			const next = it.next();
			await settleMacrotask();
			ac.abort();
			strictEqual((await next).done, true);
			strictEqual(seeks(client).length, 1);
		});

		test(`${name}Validate bounds maxRetryAttempts to Lambda's -1..10000 and retryDelayMs to >= 0`, () => {
			const validate =
				name === "pollKinesis"
					? pollKinesisValidateOptions
					: pollDynamoDBStreamsValidateOptions;
			const base =
				name === "pollKinesis"
					? { streamName: "s", shardId: "0" }
					: { streamArn: dynamodbBase.streamArn, shardId: "0" };
			validate({ ...base, maxRetryAttempts: -1, retryDelayMs: 0 });
			validate({ ...base, maxRetryAttempts: 10000 });
			throws(() => validate({ ...base, maxRetryAttempts: -2 }));
			throws(() => validate({ ...base, maxRetryAttempts: 10001 }));
			throws(() => validate({ ...base, retryDelayMs: -1 }));
		});
	}

	test("pollKafka starts the count again after a success or a discard of the same offset", async () => {
		// A rebalance can hand an offset over again after it was committed.
		const h = kafkaRetryHarness({ maxRetryAttempts: 1, retryDelayMs: 0 });
		await settleMacrotask();
		const resolvedAfter = async (response) => {
			h.setResponse(() => response);
			const batch = h.deliver("5");
			await batch.done;
			return batch.calls.resolved;
		};
		deepStrictEqual(await resolvedAfter(kafkaFailures(5)), []);
		deepStrictEqual(await resolvedAfter({ batchItemFailures: [] }), ["5"]);
		// A first failure again, not a second retry.
		deepStrictEqual(await resolvedAfter(kafkaFailures(5)), []);
		deepStrictEqual(await resolvedAfter(kafkaFailures(5)), ["5"]);
		// Discarded, so counting starts over.
		deepStrictEqual(await resolvedAfter(kafkaFailures(5)), []);
		h.ac.abort();
		await h.loop;
		deepStrictEqual(
			h.errors.map((e) => e.message),
			["Retry attempts exhausted"],
		);
	});

	test("pollKafka neither counts nor discards a batch released by shutdown", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
			maxRetryAttempts: 0,
			retryDelayMs: 0,
		});
		const ac = new AbortController();
		const errors = [];
		const loop = runPollLoop({
			poller,
			handler: async () => {
				ac.abort();
				throw new Error("boom");
			},
			timeout: 1000,
			signal: ac.signal,
			onError: (err) => errors.push(err),
		});
		await settleMacrotask();
		const batch = makeKafkaBatchPayload(kafkaBatchOf("5"));
		await consumer.runHandler()(batch.payload);
		await loop;
		deepStrictEqual(batch.calls.resolved, []);
		deepStrictEqual(
			errors.map((e) => e.message),
			["boom"],
		);
	});

	for (const [name, makePoller, shard, toSeqs] of [
		[
			"pollKinesis",
			(client) =>
				pollKinesis({
					streamName: "s",
					shardId: "0",
					pollingDelay: 0,
					retryDelayMs: 0,
					client,
				}),
			kinesisShard,
			kinesisSeqs,
		],
		[
			"pollDynamoDBStreams",
			(client) => pollDynamoDBStreams({ ...dynamodbBase, client }),
			dynamodbShard,
			dynamodbSeqs,
		],
	]) {
		test(`${name} retries forever by default`, async () => {
			// Eight retries stay under the fake shard's runaway guard.
			const responses = Array.from({ length: 8 }, () => boom);
			responses.push({});
			const { deliveries, errors } = await deliver(
				makePoller(shard(["1"])),
				toSeqs,
				responses,
			);
			deepStrictEqual(
				deliveries,
				Array.from({ length: 9 }, () => ["1"]),
			);
			strictEqual(errors.length, 8);
		});
	}

	// --- trimmed, expired and closed shards ------------------------------------

	const awsError = (name) => Object.assign(new Error(name), { name });

	test("pollDynamoDBStreams reports records trimmed while retrying and continues from TRIM_HORIZON", async () => {
		const seekTypes = [];
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					seekTypes.push(cmd.input.ShardIteratorType);
					if (cmd.input.ShardIteratorType === "AT_SEQUENCE_NUMBER") {
						throw awsError("TrimmedDataAccessException");
					}
					return { ShardIterator: cmd.input.ShardIteratorType };
				}
				const seq = cmd.input.ShardIterator === "TRIM_HORIZON" ? "5" : "1";
				return {
					NextShardIterator: "next",
					Records: [{ eventID: seq, dynamodb: { SequenceNumber: seq } }],
				};
			},
		};
		const poller = pollDynamoDBStreams({ ...dynamodbBase, client });
		const { deliveries, errors } = await deliver(poller, dynamodbSeqs, [
			boom,
			{},
		]);
		deepStrictEqual(deliveries, [["1"], ["5"]]);
		deepStrictEqual(seekTypes, [
			"LATEST",
			"AT_SEQUENCE_NUMBER",
			"TRIM_HORIZON",
		]);
		deepStrictEqual(
			errors.map((e) => e.message),
			["boom", "Records trimmed from the stream"],
		);
		deepStrictEqual(errors[1].cause, {
			package: "@middy/ecs-batch/pollDynamoDBStreams",
			data: { shardId: "0", sequenceNumbers: ["1"] },
		});
	});

	// Iterators are positions: "at:<seq>", "after:<seq>" or the initial type.
	// GetRecords on "stale" throws ExpiredIteratorException.
	const expiringShard = (seqs, toRecord, seqParam, expireOnce = new Set()) => {
		const seekInputs = [];
		const send = async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				const type = cmd.input.ShardIteratorType;
				seekInputs.push([type, cmd.input[seqParam]]);
				if (type === "AT_SEQUENCE_NUMBER")
					return { ShardIterator: `at:${cmd.input[seqParam]}` };
				if (type === "AFTER_SEQUENCE_NUMBER")
					return { ShardIterator: `after:${cmd.input[seqParam]}` };
				return { ShardIterator: "start:" };
			}
			const it = cmd.input.ShardIterator;
			if (it === "stale" || expireOnce.delete(it)) {
				throw awsError("ExpiredIteratorException");
			}
			const [kind, seq] = it.split(":");
			const pos =
				kind === "start" ? 0 : seqs.indexOf(seq) + (kind === "after" ? 1 : 0);
			// Hand back an iterator that has expired by the time it is used.
			return {
				NextShardIterator: "stale",
				Records: seqs.slice(pos, pos + 1).map(toRecord),
			};
		};
		return { seekInputs, send };
	};

	for (const [name, makePoller, toRecord, seqParam, toSeqs] of [
		[
			"pollKinesis",
			(client, opts) =>
				pollKinesis({
					streamName: "s",
					shardId: "0",
					pollingDelay: 0,
					retryDelayMs: 0,
					client,
					...opts,
				}),
			(seq) => ({ PartitionKey: "p", SequenceNumber: seq, Data: "" }),
			"StartingSequenceNumber",
			kinesisSeqs,
		],
		[
			"pollDynamoDBStreams",
			(client, opts) =>
				pollDynamoDBStreams({ ...dynamodbBase, client, ...opts }),
			(seq) => ({ eventID: seq, dynamodb: { SequenceNumber: seq } }),
			"SequenceNumber",
			dynamodbSeqs,
		],
	]) {
		test(`${name} re-seeks after the last processed record when its iterator expired`, async () => {
			const client = expiringShard(["1", "2", "3"], toRecord, seqParam);
			const { deliveries, errors } = await deliver(makePoller(client), toSeqs, [
				{},
				{},
				{},
			]);
			deepStrictEqual(deliveries, [["1"], ["2"], ["3"]]);
			deepStrictEqual(client.seekInputs, [
				["LATEST", undefined],
				["AFTER_SEQUENCE_NUMBER", "1"],
				["AFTER_SEQUENCE_NUMBER", "2"],
			]);
			strictEqual(errors.length, 0);
		});

		test(`${name} re-seeks at the retried record when the retry's iterator expired`, async () => {
			const client = expiringShard(
				["1", "2"],
				toRecord,
				seqParam,
				new Set(["at:1"]),
			);
			const { deliveries } = await deliver(makePoller(client), toSeqs, [
				boom,
				{},
			]);
			deepStrictEqual(deliveries, [["1"], ["1"]]);
			deepStrictEqual(client.seekInputs, [
				["LATEST", undefined],
				["AT_SEQUENCE_NUMBER", "1"],
				["AT_SEQUENCE_NUMBER", "1"],
			]);
		});

		test(`${name} re-seeks after a discarded batch when the iterator expired`, async () => {
			const client = expiringShard(["1", "2"], toRecord, seqParam);
			const poller = makePoller(client, { maxRetryAttempts: 0 });
			const { deliveries, errors } = await deliver(poller, toSeqs, [boom, {}]);
			deepStrictEqual(deliveries, [["1"], ["2"]]);
			deepStrictEqual(client.seekInputs, [
				["LATEST", undefined],
				["AFTER_SEQUENCE_NUMBER", "1"],
			]);
			deepStrictEqual(
				errors.map((e) => e.message),
				["boom", "Retry attempts exhausted"],
			);
		});
	}

	test("pollDynamoDBStreams starts from TRIM_HORIZON when an expired iterator's position was trimmed", async () => {
		const seekInputs = [];
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					const type = cmd.input.ShardIteratorType;
					seekInputs.push(type);
					if (type === "AFTER_SEQUENCE_NUMBER") {
						throw awsError("TrimmedDataAccessException");
					}
					return { ShardIterator: type };
				}
				if (cmd.input.ShardIterator === "stale") {
					throw awsError("ExpiredIteratorException");
				}
				const seq = cmd.input.ShardIterator === "TRIM_HORIZON" ? "9" : "1";
				return {
					NextShardIterator: "stale",
					Records: [{ eventID: seq, dynamodb: { SequenceNumber: seq } }],
				};
			},
		};
		const poller = pollDynamoDBStreams({ ...dynamodbBase, client });
		const { deliveries, errors } = await deliver(poller, dynamodbSeqs, [
			{},
			{},
		]);
		deepStrictEqual(deliveries, [["1"], ["9"]]);
		deepStrictEqual(seekInputs, [
			"LATEST",
			"AFTER_SEQUENCE_NUMBER",
			"TRIM_HORIZON",
		]);
		// No retry was pending: nothing known to be lost beyond the trim.
		deepStrictEqual(errors[0].cause.data, {
			shardId: "0",
			sequenceNumbers: [],
		});
	});

	test("pollKinesis fails the poll with the child shards once its shard is closed", async () => {
		const childShards = [
			{ ShardId: "shardId-1", ParentShards: ["shardId-0"], HashKeyRange: {} },
		];
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return {
					NextShardIterator: null,
					ChildShards: childShards,
					Records: [{ PartitionKey: "p", SequenceNumber: "1", Data: "" }],
				};
			},
		};
		const poller = pollKinesis({
			streamName: "s",
			shardId: "shardId-0",
			client,
		});
		const handled = [];
		await rejects(
			runPollLoop({
				poller,
				timeout: 1000,
				signal: new AbortController().signal,
				handler: async (event) => {
					handled.push(kinesisSeqs(event));
					return {};
				},
			}),
			{
				name: "SourceClosedError",
				message: "Shard closed",
				cause: {
					package: "@middy/ecs-batch/pollKinesis",
					data: { shardId: "shardId-0", childShards },
				},
			},
		);
		// The shard's last records are still delivered first.
		deepStrictEqual(handled, [["1"]]);
	});

	test("pollDynamoDBStreams fails the poll once its shard is closed, also on an empty read", async () => {
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return { NextShardIterator: null, Records: [] };
			},
		};
		const poller = pollDynamoDBStreams({ ...dynamodbBase, client });
		await rejects(poller.poll(new AbortController().signal).next(), {
			name: "SourceClosedError",
			message: "Shard closed",
			cause: {
				package: "@middy/ecs-batch/pollDynamoDBStreams",
				data: { shardId: "0" },
			},
		});
	});

	test("pollKinesis fails the poll once a discarded batch was the closed shard's last", async () => {
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return {
					NextShardIterator: null,
					Records: [{ PartitionKey: "p", SequenceNumber: "1", Data: "" }],
				};
			},
		};
		const poller = pollKinesis({
			streamName: "s",
			shardId: "0",
			maxRetryAttempts: 0,
			client,
		});
		const it = poller.poll(new AbortController().signal);
		await it.next();
		await rejects(it.next(), { name: "SourceClosedError" });
	});

	test("runWorker exits 2 when its source closed for good", async () => {
		const closed = Object.assign(new Error("Shard closed"), {
			name: "SourceClosedError",
		});
		const errors = [];
		const exits = [];
		const poller = {
			source: "test",
			async *poll() {
				yield { Records: [1] };
				throw closed;
			},
			acknowledge: noop,
		};
		const { onSigterm } = await runWorker(
			{
				handler: async () => ({}),
				poller,
				timeout: 1000,
				gracefulShutdownMs: 1000,
				onError: (err) => errors.push(err),
			},
			{ exit: (code) => exits.push(code) },
		);
		await settleMacrotask();
		process.removeListener("SIGTERM", onSigterm);
		deepStrictEqual(errors, [closed]);
		deepStrictEqual(exits, [2]);
	});

	test("runPrimary stops the task with exit code 2 when a worker's source closed", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
		const cluster = makeFakeCluster();
		const exits = [];
		const { onSigterm } = await runPrimary(
			{ workers: 2 },
			{ cluster, fetch: noMeta, exit: (code) => exits.push(code) },
		);
		process.removeListener("SIGTERM", onSigterm);
		cluster.exit(1, 2);
		// No replacement: the source would only be closed again.
		t.mock.timers.tick(60_000);
		strictEqual(cluster.forks, 2);
		// The other worker drains as on SIGTERM.
		deepStrictEqual(cluster.killed, [[2, "SIGTERM"]]);
		deepStrictEqual(exits, []);
		cluster.exit(2, 0);
		deepStrictEqual(exits, [2]);
	});

	test("pollKafka cuts the backoff short when a heartbeat is rejected by a rebalance", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
			retryDelayMs: 60_000,
			heartbeatIntervalMs: 5,
		});
		const ac = new AbortController();
		const loop = runPollLoop({
			poller,
			handler: boom,
			timeout: 1000,
			signal: ac.signal,
		});
		await settleMacrotask();
		const batch = makeKafkaBatchPayload(kafkaBatchOf("5"));
		batch.payload.heartbeat = async () => {
			throw new Error("The group is rebalancing, so a rejoin is needed");
		};
		let settled = false;
		const done = consumer
			.runHandler()(batch.payload)
			.then(
				() => {
					settled = true;
				},
				() => {
					settled = true;
				},
			);
		await sleep(50);
		strictEqual(settled, true, "eachBatch returns so kafkajs can rejoin");
		await done;
		deepStrictEqual(batch.calls.resolved, []);
		ac.abort();
		await loop;
	});

	test("pollKafka discards without an onError when polled outside the runner", async () => {
		const consumer = makeFakeKafkaConsumer();
		const poller = pollKafka({
			brokers: ["b1"],
			groupId: "g",
			topics: ["t1"],
			consumer,
			maxRetryAttempts: 0,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		const { firstNext } = await drainKafkaSetup(it);
		const batch = makeKafkaBatchPayload(kafkaBatchOf("5"));
		const done = consumer.runHandler()(batch.payload);
		await firstNext;
		// Resumed without an acknowledgement: every record failed, no retry left.
		const next = it.next();
		await done;
		deepStrictEqual(batch.calls.resolved, ["5"]);
		ac.abort();
		await next;
	});

	test("pollKinesis treats a NextShardIterator the SDK left out as a closed shard", async () => {
		// The SDK's JSON deserializer drops a null member rather than keeping it.
		const client = {
			send: async (cmd) => {
				if (cmd.constructor.name === "GetShardIteratorCommand") {
					return { ShardIterator: "i" };
				}
				return { Records: [] };
			},
		};
		const poller = pollKinesis({ streamName: "s", shardId: "0", client });
		await rejects(poller.poll(new AbortController().signal).next(), {
			name: "SourceClosedError",
		});
	});

	test("runWorker exits 1 when a poller throws a non-error value", async () => {
		const exits = [];
		const errors = [];
		const poller = {
			source: "test",
			// biome-ignore lint/correctness/useYield: fails before its first batch
			async *poll() {
				throw undefined;
			},
			acknowledge: noop,
		};
		const { onSigterm } = await runWorker(
			{
				handler: noop,
				poller,
				timeout: 1000,
				gracefulShutdownMs: 1000,
				onError: (err) => errors.push(err),
			},
			{ exit: (code) => exits.push(code) },
		);
		await settleMacrotask();
		process.removeListener("SIGTERM", onSigterm);
		deepStrictEqual(errors, [undefined]);
		deepStrictEqual(exits, [1]);
	});
});
