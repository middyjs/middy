import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { describe, test } from "node:test";
import { LocalDurableTestRunner } from "@aws/durable-execution-sdk-js-testing";
import { executionModeDurableContext } from "./executionModeDurableContext.js";
import middy from "./index.js";

const _event = {};
const _context = {};

// Non-Promise thenable built via a computed key: a literal `then` property
// would trip lint/suspicious/noThenProperty, which should stay enabled to
// catch accidental thenables; these tests need one deliberately to assert
// middy never awaits it.
const thenKey = "then";
const createThenable = (onThen) => ({ [thenKey]: onThen });

// Scoped under a describe so the durable runner setup/teardown beforeEach hooks
// register on this suite, not the shared root. Under the node-test runner
// (isolation:"none") a root-level beforeEach runs before every test in every
// core file; the durable setup would then run before the timer-mocked
// index/streamify tests and vice versa.
describe("executionModeDurableContext", () => {
	test.beforeEach(async () => {
		await LocalDurableTestRunner.setupTestEnvironment({
			skipTime: true,
		});
	});
	test.afterEach(async () => {
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

	test("Should not await a thenable returned by requestEnd in durable context", async (t) => {
		// Real-Promises-only contract: only a real Promise from requestEnd is
		// awaited; a plain thenable is ignored, so its then() must never run.
		let thenAwaited = false;
		const handler = middy({
			executionMode: executionModeDurableContext,
			requestEnd: () =>
				createThenable((resolve) => {
					thenAwaited = true;
					resolve();
				}),
		}).handler(() => "ok");
		const runner = new LocalDurableTestRunner({ handlerFunction: handler });

		const execution = await runner.run({ payload: {} });

		strictEqual(execution.getStatus(), "SUCCEEDED");
		strictEqual(thenAwaited, false);
	});

	test("Should await async requestEnd hook and propagate its rejection in durable context", async (t) => {
		// An async requestEnd hook returns a real Promise; it must be awaited
		// so its rejection is caught and propagated like a sync throw.
		const hookErr = new Error("requestEnd failed");
		const handler = middy({
			executionMode: executionModeDurableContext,
			requestEnd: async () => {
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
});
