// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";

import middy from "../core/index.js";
import { initLogger, initMetrics } from "./index.js";
import { MockExporter } from "./MockExporter.js";
import { StdoutExporter } from "./StdoutExporter.js";

const hrTime = [1740000000, 500000000];
test.mock.method(process, "hrtime", () => hrTime);

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

// TODO add in option to allow verbose, debug to export
test("It should init logger and run correctly", async (t) => {
	const exporter = new MockExporter(t);
	const logger = initLogger({ exporter });

	logger.error(new Error("error", { cause: "cause" }));
	logger.warn("warn");
	logger.info("info");
	logger.debug("debug");
	logger.verbose("verbose");

	const expected = [
		[
			{
				Attributes: undefined,
				Body: {
					cause: "cause",
					message: "Error: error",
					trace: undefined,
				},
				SeverityNumber: 17,
				SeverityText: "ERROR",
				Timestamp: exporter.test.mock.calls[0].arguments[0].Timestamp,
			},
		],
		[
			{
				Attributes: undefined,
				Body: "warn",
				SeverityNumber: 13,
				SeverityText: "WARN",
				Timestamp: exporter.test.mock.calls[1].arguments[0].Timestamp,
			},
		],
		[
			{
				Attributes: undefined,
				Body: "info",
				SeverityNumber: 9,
				SeverityText: "INFO",
				Timestamp: exporter.test.mock.calls[2].arguments[0].Timestamp,
			},
		],
		// [
		// 	{
		// 		Attributes: undefined,
		// 		Body: "debug",
		// 		SeverityNumber: 9,
		// 		SeverityText: "DEBUG",
		// 		Timestamp: exporter.test.mock.calls[3].arguments[0].Timestamp,
		// 	},
		// ],
		// [
		// 	{
		// 		Attributes: undefined,
		// 		Body: "verbose",
		// 		SeverityNumber: 9,
		// 		SeverityText: "TRACE",
		// 		Timestamp: exporter.test.mock.calls[4].arguments[0].Timestamp,
		// 	},
		// ],
	];
	deepStrictEqual(
		exporter.test.mock.calls.map((t) => t.arguments),
		expected,
	);
});

// test("It should init metrics and run correctly", async (t) => {
// 	const exporter = new MockExporter(t);
// 	const reader = ''
// 	const metrics = initMetrics({ readers:[reader] });

// 	const meter = metrics.getMeter('default')
// 	meter.createCounter("Metric").add(1)

// 	const expected = []

// 	deepStrictEqual(
// 		exporter.test.mock.calls.map((t) => t.arguments),
// 		expected,
// 	);
// })
