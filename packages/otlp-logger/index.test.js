// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import { initLogger } from "../otlp/index.js";
import { MockExporter } from "../otlp/MockExporter.js";
import otlpContextMiddleware from "../otlp-context/index.js";
import otlpLoggerMiddleware from "./index.js";

const defaultContext = {
	callbackWaitsForEmptyEventLoop: true,
	functionName: "myfunction",
	functionVersion: "1.0",
	invokedFunctionArn:
		"arn:aws:lambda:us-west-2:123456789012:function:my-function",
	memoryLimitInMB: "17",
	awsRequestId: "abc22",
	logGroupName: "my-function-lg",
	logStreamName: "my-function-ls",
	getRemainingTimeInMillis: () => 1000,
};

test("It should log event and response", async (t) => {
	const exporter = new MockExporter(t);
	const logger = initLogger({ exporter });
	console.log(logger);
	const handler = middy((event) => event).use([
		otlpContextMiddleware({ logger }),
		otlpLoggerMiddleware({
			logEvent: true,
			logResponse: true,
			logError: true,
		}),
	]);

	const event = { foo: "bar", fuu: "baz" };
	const response = await handler(event, defaultContext);
	// console.log({ event })
	// console.log({ response: event })
	deepEqual(exporter.calls[0].arguments, [{ event }]);
	// deepEqual(console.log.mock.calls[1].arguments, [{ response: event }]);
	deepEqual(response, event);
	equal(1, 0);
});
