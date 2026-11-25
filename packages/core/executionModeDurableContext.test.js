import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { LocalDurableTestRunner } from "@aws/durable-execution-sdk-js-testing";
import { isExecutionModeDurable } from "@middy/util";
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

// Scoped under a describe so the durable runner setup/teardown hooks register
// on this suite, not the shared root, where under the node-test runner
// (isolation:"none") they would wrap the timer-mocked index/streamify tests too.
// One checkpoint worker serves the whole suite, and `skipTime` is off: its
// sinon fake clock clears and swallows the test runner's own timers, so under
// process isolation (`npm run test:unit`) the subtests never reached the parent
// and the file reported as a single test. None of these tests wait on durable
// timers. Each `runner.run` holds a fixed 100ms in the SDK, so they run
// concurrently.
describe("@middy/core/DurableContext", () => {
	describe("executionModeDurableContext", { concurrency: true }, () => {
		before(async () => {
			await LocalDurableTestRunner.setupTestEnvironment();
		});
		after(async () => {
			await LocalDurableTestRunner.teardownTestEnvironment();
		});

		test("Should detect the real SDK durable context via isExecutionModeDurable", async (t) => {
			let detected;
			const handler = middy({
				executionMode: executionModeDurableContext,
			}).handler((event, context) => {
				detected = isExecutionModeDurable(context);
				return "ok";
			});
			const runner = new LocalDurableTestRunner({ handlerFunction: handler });

			const execution = await runner.run({ payload: {} });

			strictEqual(execution.getStatus(), "SUCCEEDED");
			strictEqual(detected, true);
		});

		test("Should expose tenantId from the Lambda context to the handler under the real SDK", async (t) => {
			// The SDK reads `tenantId` from the Lambda context it is invoked with
			// (`context.tenantId`) and exposes only `durableExecutionArn` under
			// `context.executionContext`. The local runner builds its own Lambda
			// context per invocation, so the handler it invokes is wrapped to add
			// the tenant id the same way Lambda tenant isolation would.
			let seen;
			const handler = middy({
				executionMode: executionModeDurableContext,
			}).handler((event, context) => {
				seen = context.tenantId;
				return "ok";
			});
			const runner = new LocalDurableTestRunner({
				handlerFunction: (event, context) =>
					handler(event, { ...context, tenantId: "tenant-123" }),
			});

			const execution = await runner.run({ payload: {} });

			strictEqual(execution.getStatus(), "SUCCEEDED");
			strictEqual(seen, "tenant-123");
		});

		test("Should expose getRemainingTimeInMillis from the Lambda context to the handler under the real SDK", async (t) => {
			let seen;
			const handler = middy({
				executionMode: executionModeDurableContext,
			}).handler((event, context) => {
				seen = context.getRemainingTimeInMillis();
				return "ok";
			});
			const runner = new LocalDurableTestRunner({
				handlerFunction: (event, context) =>
					handler(event, { ...context, getRemainingTimeInMillis: () => 1234 }),
			});

			const execution = await runner.run({ payload: {} });

			strictEqual(execution.getStatus(), "SUCCEEDED");
			strictEqual(seen, 1234);
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

		test("Should throw AggregateError for a primitive handler error when requestEnd also throws in durable context", async (t) => {
			const handler = middy({
				executionMode: executionModeDurableContext,
				requestEnd: () => {
					throw new Error("requestEnd failed");
				},
			}).handler(() => {
				throw "boom";
			});
			const runner = new LocalDurableTestRunner({ handlerFunction: handler });

			const execution = await runner.run({ payload: {} });

			strictEqual(execution.getStatus(), "FAILED");
			strictEqual(
				execution.getError().errorMessage,
				"Error thrown in requestEnd hook",
			);
		});

		test("Should throw AggregateError for a null handler error when requestEnd also throws in durable context", async (t) => {
			const handler = middy({
				executionMode: executionModeDurableContext,
				requestEnd: () => {
					throw new Error("requestEnd failed");
				},
			}).handler(() => {
				throw null;
			});
			const runner = new LocalDurableTestRunner({ handlerFunction: handler });

			const execution = await runner.run({ payload: {} });

			strictEqual(execution.getStatus(), "FAILED");
			strictEqual(
				execution.getError().errorMessage,
				"Error thrown in requestEnd hook",
			);
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

		test("Should throw AggregateError when handler and requestEnd hook both throw in durable context", async (t) => {
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
			strictEqual(
				execution.getError().errorMessage,
				"Error thrown in requestEnd hook",
			);
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

		const withRemainingTime = (handler, remainingTimeInMillis) => {
			return (event, context) =>
				handler(event, {
					...context,
					getRemainingTimeInMillis: () => remainingTimeInMillis,
				});
		};
		const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

		test("Should not race a handler that outlasts the remaining time under the default early timeout", async (t) => {
			const handler = middy({
				executionMode: executionModeDurableContext,
			}).handler(async (event, context) => {
				await context.step("checkpointed", async () => "done");
				return context.step("slow", async () => {
					await sleep(150);
					return "ok";
				});
			});
			const runner = new LocalDurableTestRunner({
				handlerFunction: withRemainingTime(handler, 50),
			});

			const execution = await runner.run({ payload: {} });

			strictEqual(execution.getStatus(), "SUCCEEDED");
			strictEqual(execution.getResult(), "ok");
		});

		test("Should race the handler under an early timeout that was set explicitly", async (t) => {
			const handler = middy({
				executionMode: executionModeDurableContext,
				timeoutEarlyInMillis: 10,
				timeoutEarlyResponse: () => "early",
			}).handler(async () => {
				await sleep(150);
				return "late";
			});
			const runner = new LocalDurableTestRunner({
				handlerFunction: withRemainingTime(handler, 50),
			});

			const execution = await runner.run({ payload: {} });

			strictEqual(execution.getStatus(), "SUCCEEDED");
			strictEqual(execution.getResult(), "early");
		});

		test("Should disarm an explicit early timeout when the invocation suspends", async (t) => {
			let timeoutEarlyResponses = 0;
			const handler = middy({
				executionMode: executionModeDurableContext,
				timeoutEarlyInMillis: 10,
				timeoutEarlyResponse: () => {
					timeoutEarlyResponses++;
					return "early";
				},
			}).handler(async (event, context) => {
				await context.wait("pause", { seconds: 1 });
				return "done";
			});
			const runner = new LocalDurableTestRunner({
				handlerFunction: withRemainingTime(handler, 500),
			});

			const execution = await runner.run({ payload: {} });

			strictEqual(execution.getStatus(), "SUCCEEDED");
			strictEqual(execution.getResult(), "done");
			strictEqual(timeoutEarlyResponses, 0);
		});

		test("Should number the steps of nested middy handlers on the one durable context", async (t) => {
			const processed = [];
			const record = middy().handler((item, context) =>
				context.step("process", async () => {
					processed.push(item);
					return `processed:${item}`;
				}),
			);
			const handler = middy({
				executionMode: executionModeDurableContext,
			}).handler(async (event, context) => {
				const a = await record("A", context);
				const b = await record("B", context);
				const c = await context.step("outer", async () => "outer");
				return { a, b, c };
			});
			const runner = new LocalDurableTestRunner({ handlerFunction: handler });

			const execution = await runner.run({ payload: {} });

			strictEqual(execution.getStatus(), "SUCCEEDED");
			deepStrictEqual(execution.getResult(), {
				a: "processed:A",
				b: "processed:B",
				c: "outer",
			});
			deepStrictEqual(processed, ["A", "B"]);
		});

		test("Should disarm the explicit early timeout of a nested middy handler when the invocation suspends", async (t) => {
			let timeoutEarlyResponses = 0;
			const nested = middy({
				timeoutEarlyInMillis: 10,
				timeoutEarlyResponse: () => {
					timeoutEarlyResponses++;
					return "early";
				},
			}).handler(async (event, context) => {
				await context.wait("pause", { seconds: 1 });
				return "done";
			});
			const handler = middy({
				executionMode: executionModeDurableContext,
			}).handler((event, context) => nested(event, context));
			const runner = new LocalDurableTestRunner({
				handlerFunction: withRemainingTime(handler, 500),
			});

			const execution = await runner.run({ payload: {} });

			strictEqual(execution.getStatus(), "SUCCEEDED");
			strictEqual(execution.getResult(), "done");
			strictEqual(timeoutEarlyResponses, 0);
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
});
