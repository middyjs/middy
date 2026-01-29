// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { Bench } from "tinybench";

import {
	getInternal,
	jsonSafeParse,
	normalizeHttpResponse,
	processCache,
} from "./index.js";

const bench = new Bench({ time: 1_000 });

await bench
	.add("getInternal", async () => {
		await getInternal(true, {
			internal: {
				key: Promise.resolve("value"),
			},
		});
	})
	.add("processCache w/ { cacheExpiry: 0 }", async () => {
		await processCache({ cacheExpiry: 0, cacheKey: "key" });
	})
	.add("processCache w/ { cacheExpiry: -1 }", async () => {
		await processCache({ cacheExpiry: -1, cacheKey: "key" });
	})
	.add("jsonSafeParse", async () => {
		await jsonSafeParse('{"key":"value"}');
	})
	.add("normalizeHttpResponse", async () => {
		await normalizeHttpResponse({});
	})
	.run();

console.table(bench.table());
