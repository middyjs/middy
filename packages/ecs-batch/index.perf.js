// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { test } from "node:test";
import { runPollLoop } from "./index.js";

test("perf: runPollLoop drives 10k stub events under 1s", async () => {
	const events = Array.from({ length: 10_000 }, (_, i) => ({ Records: [i] }));
	const poller = {
		source: "perf",
		async *poll() {
			for (const e of events) yield e;
		},
		async acknowledge() {},
	};
	const ac = new AbortController();
	const t = Date.now();
	await runPollLoop({
		poller,
		handler: async () => ({ batchItemFailures: [] }),
		timeout: 60_000,
		signal: ac.signal,
	});
	const elapsed = Date.now() - t;
	if (elapsed > 1000) throw new Error(`runPollLoop too slow: ${elapsed}ms`);
});
