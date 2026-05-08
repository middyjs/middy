import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";

import middy from "../core/index.js";

import cloudformationResponse, {
	cloudformationResponseValidateOptions,
} from "./index.js";

const defaultEvent = {
	RequestType: "Create",
	RequestId: "RequestId",
	LogicalResourceId: "LogicalResourceId",
	StackId: "StackId",
};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
	logStreamName: "2026/03/14/[$LATEST]abcdef1234567890",
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
		PhysicalResourceId: "2026/03/14/[$LATEST]abcdef1234567890",
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
		PhysicalResourceId: "2026/03/14/[$LATEST]abcdef1234567890",
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
		PhysicalResourceId: "2026/03/14/[$LATEST]abcdef1234567890",
	});
});

test("It should use event.PhysicalResourceId on Update", async (t) => {
	const handler = middy((event, context) => {});

	handler.use(cloudformationResponse());

	const event = {
		...defaultEvent,
		RequestType: "Update",
		PhysicalResourceId: "custom-physical-id",
	};
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		Status: "SUCCESS",
		RequestId: "RequestId",
		LogicalResourceId: "LogicalResourceId",
		StackId: "StackId",
		PhysicalResourceId: "custom-physical-id",
	});
});

test("It should use event.PhysicalResourceId on Delete", async (t) => {
	const handler = middy((event, context) => {});

	handler.use(cloudformationResponse());

	const event = {
		...defaultEvent,
		RequestType: "Delete",
		PhysicalResourceId: "custom-physical-id",
	};
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		Status: "SUCCESS",
		RequestId: "RequestId",
		LogicalResourceId: "LogicalResourceId",
		StackId: "StackId",
		PhysicalResourceId: "custom-physical-id",
	});
});

test("It should prefer handler-set PhysicalResourceId over event", async (t) => {
	const handler = middy((event, context) => {
		return { PhysicalResourceId: "handler-id" };
	});

	handler.use(cloudformationResponse());

	const event = {
		...defaultEvent,
		RequestType: "Update",
		PhysicalResourceId: "event-id",
	};
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		Status: "SUCCESS",
		RequestId: "RequestId",
		LogicalResourceId: "LogicalResourceId",
		StackId: "StackId",
		PhysicalResourceId: "handler-id",
	});
});

test("It should use event.PhysicalResourceId on error during Update", async (t) => {
	const handler = middy((event, context) => {
		throw new Error("Update Error");
	});

	handler.use(cloudformationResponse());

	const event = {
		...defaultEvent,
		RequestType: "Update",
		PhysicalResourceId: "custom-physical-id",
	};
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, {
		Status: "FAILED",
		Reason: "Update Error",
		RequestId: "RequestId",
		LogicalResourceId: "LogicalResourceId",
		StackId: "StackId",
		PhysicalResourceId: "custom-physical-id",
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
		PhysicalResourceId: "2026/03/14/[$LATEST]abcdef1234567890",
	});
});

test("cloudformationResponseValidateOptions accepts empty options and rejects anything", () => {
	cloudformationResponseValidateOptions({});
	cloudformationResponseValidateOptions();
	try {
		cloudformationResponseValidateOptions({ any: 1 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/cloudformation-response");
	}
});
