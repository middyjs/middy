import { deepStrictEqual } from "node:assert/strict";
import { test } from "node:test";

import middy from "../core/index.js";

import cloudformationResponse from "./index.js";

const defaultEvent = {
	RequestType: "Create",
	RequestId: "RequestId",
	LogicalResourceId: "LogicalResourceId",
	StackId: "StackId",
};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should return SUCCESS when empty response", async (t) => {
	const handler = middy((event, context) => {});

	handler.use(cloudformationResponse());

	const event = defaultEvent;
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		Status: "SUCCESS",
		RequestId: "RequestId",
		LogicalResourceId: "LogicalResourceId",
		StackId: "StackId",
	});
});

test("It should return SUCCESS when empty object", async (t) => {
	const handler = middy((event, context) => {
		return {};
	});

	handler.use(cloudformationResponse());

	const event = defaultEvent;
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		Status: "SUCCESS",
		RequestId: "RequestId",
		LogicalResourceId: "LogicalResourceId",
		StackId: "StackId",
	});
});

test("It should return FAILURE when error thrown", async (t) => {
	const handler = middy((event, context) => {
		throw new Error("Internal Error");
	});

	handler.use(cloudformationResponse());

	const event = defaultEvent;
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		Status: "FAILED",
		Reason: "Internal Error",
		RequestId: "RequestId",
		LogicalResourceId: "LogicalResourceId",
		StackId: "StackId",
	});
});

test("It should not override response values", async (t) => {
	const handler = middy((event, context) => {
		return {
			Status: "FAILED",
			RequestId: "RequestId*",
			LogicalResourceId: "LogicalResourceId*",
			StackId: "StackId*",
		};
	});

	handler.use(cloudformationResponse());

	const event = defaultEvent;
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		Status: "FAILED",
		RequestId: "RequestId*",
		LogicalResourceId: "LogicalResourceId*",
		StackId: "StackId*",
	});
});
