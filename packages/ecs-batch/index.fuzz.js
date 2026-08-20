// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { test } from "node:test";
import { ecsBatchValidateOptions } from "./index.js";

const noop = () => {};
const validPoller = { source: "x", poll: noop, acknowledge: noop };

test("fuzz: ecsBatchValidateOptions tolerates random shapes without throwing non-TypeError", () => {
	const samples = [
		undefined,
		null,
		{},
		{ handler: noop },
		{ poller: validPoller },
		{ handler: noop, poller: validPoller, workers: -1 },
		{ handler: "not-a-fn", poller: validPoller },
		{ handler: noop, poller: { source: 1, poll: 2, acknowledge: 3 } },
		{ handler: noop, poller: validPoller, timeout: -1 },
		{ handler: noop, poller: validPoller, gracefulShutdownMs: "x" },
	];
	for (const s of samples) {
		try {
			ecsBatchValidateOptions(s);
		} catch (err) {
			if (!(err instanceof TypeError))
				throw new Error(`unexpected non-TypeError: ${err}`);
		}
	}
});
