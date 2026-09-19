// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { bench } from "node:bench";
import { runPollLoop } from "./index.js";

// One sample drains the whole stub stream, so the reported rate is events/s.
const operations = 10_000;
// The original assertion: 10k events inside one second.
const minimumRate = 10_000;

const poller = {
	source: "perf",
	async *poll() {
		for (let i = 0; i < operations; i++) yield { Records: [i] };
	},
	async acknowledge() {},
};

bench("ecs-batch: runPollLoop over stub events", async (b) => {
	const ac = new AbortController();
	b.start();
	await runPollLoop({
		poller,
		handler: async () => ({ batchItemFailures: [] }),
		timeout: 60_000,
		signal: ac.signal,
	});
	const { rate } = b.end(operations);
	if (rate < minimumRate) {
		throw new Error(
			`runPollLoop too slow: ${Math.round(rate)} events/s, expected >= ${minimumRate}`,
		);
	}
});
