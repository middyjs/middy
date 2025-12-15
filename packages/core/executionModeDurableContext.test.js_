import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { LocalDurableTestRunner } from "@aws/durable-execution-sdk-js-testing";
import middy, { executionModeDurableContext } from "./index.js";

const _event = {};
const _context = {
	lambdaContext: {
		getRemainingTimeInMillis: () => 1000, // TODO update when supported in DurableContext
	},
};

test.beforeEach(async (t) => {
	await LocalDurableTestRunner.setupTestEnvironment({
		skipTime: true,
	});
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
});
test.afterEach(async (t) => {
	t.mock.reset();
	await LocalDurableTestRunner.teardownTestEnvironment();
});

test("Should return with executionMode:executionModeDurableContext using string", async (t) => {
	const input = "x".repeat(1024 * 1024);
	const handler = middy({
		executionMode: executionModeDurableContext,
	}).handler((event, context, { signal }) => {
		return event;
	});
	const runner = new LocalDurableTestRunner({ handlerFunction: handler });

	const execution = await runner.run({ payload: input });

	equal(execution.getOperations().length, 0);
	equal(execution.getStatus(), "SUCCEEDED");
	equal(execution.getResult(), input);
});

test("Should return with executionMode:executionModeDurableContext using object", async (t) => {
	const input = {};
	const handler = middy({
		executionMode: executionModeDurableContext,
	}).handler((event, context, { signal }) => {
		return event;
	});
	const runner = new LocalDurableTestRunner({ handlerFunction: handler });

	const execution = await runner.run({ payload: input });

	equal(execution.getOperations().length, 0);
	equal(execution.getStatus(), "SUCCEEDED");
	deepEqual(execution.getResult(), input);
});

test("Should return with executionMode:executionModeDurableContext using body:undefined", async (t) => {
	const input = {
		statusCode: 200,
		headers: {
			"Content-Type": "plain/text",
		},
	};
	const handler = middy({
		executionMode: executionModeDurableContext,
	}).handler((event, context, { signal }) => {
		return event;
	});
	const runner = new LocalDurableTestRunner({ handlerFunction: handler });

	const execution = await runner.run({ payload: input });

	equal(execution.getOperations().length, 0);
	equal(execution.getStatus(), "SUCCEEDED");
	deepEqual(execution.getResult(), input);
});

test("Should return with executionMode:executionModeDurableContext using body:string", async (t) => {
	const input = {
		statusCode: 200,
		headers: {
			"Content-Type": "plain/text",
		},
		body: "x".repeat(1024 * 1024),
	};
	const handler = middy({
		executionMode: executionModeDurableContext,
	}).handler((event, context, { signal }) => {
		return event;
	});
	const runner = new LocalDurableTestRunner({ handlerFunction: handler });

	const execution = await runner.run({ payload: input });

	equal(execution.getOperations().length, 0);
	equal(execution.getStatus(), "SUCCEEDED");
	deepEqual(execution.getResult(), input);
});

test("Should return with executionMode:executionModeDurableContext using body:''", async (t) => {
	const input = {
		statusCode: 301,
		headers: {
			"Content-Type": "plain/text",
			Location: "https://example.com",
		},
		body: "",
	};
	const handler = middy({
		executionMode: executionModeDurableContext,
	}).handler((event, context, { signal }) => {
		return event;
	});
	const runner = new LocalDurableTestRunner({ handlerFunction: handler });

	const execution = await runner.run({ payload: input });

	equal(execution.getOperations().length, 0);
	equal(execution.getStatus(), "SUCCEEDED");
	deepEqual(execution.getResult(), input);
});
