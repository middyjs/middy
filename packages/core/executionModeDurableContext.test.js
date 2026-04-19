import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { LocalDurableTestRunner } from "@aws/durable-execution-sdk-js-testing";
import { executionModeDurableContext } from "./executionModeDurableContext.js";
import middy from "./index.js";

const _event = {};
const _context = {};

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

	strictEqual(execution.getOperations().length, 0);
	strictEqual(execution.getStatus(), "SUCCEEDED");
	strictEqual(execution.getResult(), input);
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

	strictEqual(execution.getOperations().length, 0);
	strictEqual(execution.getStatus(), "SUCCEEDED");
	deepStrictEqual(execution.getResult(), input);
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

	strictEqual(execution.getOperations().length, 0);
	strictEqual(execution.getStatus(), "SUCCEEDED");
	deepStrictEqual(execution.getResult(), input);
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

	strictEqual(execution.getOperations().length, 0);
	strictEqual(execution.getStatus(), "SUCCEEDED");
	deepStrictEqual(execution.getResult(), input);
});

test("Should trigger requestStart and requestEnd hooks with executionModeDurableContext", async (t) => {
	let startCalled = false;
	let endCalled = false;
	const handler = middy({
		executionMode: executionModeDurableContext,
		requestStart: () => {
			startCalled = true;
		},
		requestEnd: () => {
			endCalled = true;
		},
	}).handler((event) => event);
	const runner = new LocalDurableTestRunner({ handlerFunction: handler });

	const execution = await runner.run({ payload: {} });

	strictEqual(execution.getStatus(), "SUCCEEDED");
	ok(startCalled);
	ok(endCalled);
});

test("Should propagate requestEnd hook error when handler succeeds in durable context", async (t) => {
	const hookErr = new Error("requestEnd failed");
	const handler = middy({
		executionMode: executionModeDurableContext,
		requestEnd: () => {
			throw hookErr;
		},
	}).handler(() => "ok");
	const runner = new LocalDurableTestRunner({ handlerFunction: handler });

	const execution = await runner.run({ payload: {} });

	strictEqual(execution.getStatus(), "FAILED");
	strictEqual(execution.getError().errorMessage, "requestEnd failed");
});

test("Should preserve handler error when requestEnd hook also throws in durable context", async (t) => {
	const handlerErr = new Error("handler failed");
	const hookErr = new Error("requestEnd failed");
	const handler = middy({
		executionMode: executionModeDurableContext,
		requestEnd: () => {
			throw hookErr;
		},
	}).handler(() => {
		throw handlerErr;
	});
	const runner = new LocalDurableTestRunner({ handlerFunction: handler });

	const execution = await runner.run({ payload: {} });

	strictEqual(execution.getStatus(), "FAILED");
	strictEqual(execution.getError().errorMessage, "handler failed");
});

test("Should propagate handler error with no requestEnd error in durable context", async (t) => {
	const handlerErr = new Error("handler failed");
	const handler = middy({
		executionMode: executionModeDurableContext,
	}).handler(() => {
		throw handlerErr;
	});
	const runner = new LocalDurableTestRunner({ handlerFunction: handler });

	const execution = await runner.run({ payload: {} });

	strictEqual(execution.getStatus(), "FAILED");
	strictEqual(execution.getError().errorMessage, "handler failed");
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

	strictEqual(execution.getOperations().length, 0);
	strictEqual(execution.getStatus(), "SUCCEEDED");
	deepStrictEqual(execution.getResult(), input);
});
