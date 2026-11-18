// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import { expect, test } from "tstyche";
import openTelemetryProtocolLoggerMiddleware from "./index.js";

test("use with default options", () => {
	const middleware = openTelemetryProtocolLoggerMiddleware();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("use with all options", () => {
	const middleware = openTelemetryProtocolLoggerMiddleware({
		logger: console,
		logEvent: true,
		logResponse: true,
		logError: true,
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
