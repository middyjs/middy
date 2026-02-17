// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	GetParametersByPathCommand,
	GetParametersCommand,
	SSMClient,
} from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolves({ Parameters: [{ Name: "/key", Value: "value" }] })
		.on(GetParametersByPathCommand)
		.resolves({ Parameters: [{ Name: "/key", Value: "value" }] });
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: SSMClient,
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler();

const event = {};
await bench
	.add("without cache", async () => {
		try {
			await coldHandler(event, context);
		} catch (_e) {}
	})
	.add("with cache", async () => {
		try {
			await warmHandler(event, context);
		} catch (_e) {}
	})

	.run();

console.table(bench.table());
