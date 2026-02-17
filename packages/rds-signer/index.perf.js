// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { Signer } from "@aws-sdk/rds-signer";
import { mockClient } from "aws-sdk-client-mock";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};

// Mock the Signer to avoid actual AWS calls
class MockSigner {
	constructor() {}
	getAuthToken() {
		return Promise.resolve(
			"db.example.com:5432/?Action=connect&DBUser=testuser&X-Amz-Security-Token=mock-token",
		);
	}
}

const setupHandler = (options = {}) => {
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: MockSigner,
			fetchData: {
				token: {
					hostname: "db.example.com",
					port: 5432,
					username: "testuser",
					region: "us-east-1",
				},
			},
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
