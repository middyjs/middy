import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { after, before, describe, mock, test } from "node:test";

// These tests mock `withDurableExecution` as a passthrough so the inner async
// handler can be invoked directly with a context we control. This exposes
// behavior (copyKeys, hook-error cause chaining) that the durable test runner
// serializes away (TestResultError drops `.cause`).

// The module mock and the imports it affects are scoped to a `before` hook (not
// module top-level) so they do not leak into the sibling durable test files
// when every core test file shares one process (the node-test runner's
// isolation:"none"). A cache-busting query on the SUT import forces it to
// re-evaluate against the freshly-mocked dependency, leaving the real,
// already-cached module untouched for the other files.
describe("@middy/core/DurableContext", () => {
	describe("executionModeDurableContext (mocked withDurableExecution)", () => {
		let executionModeDurableContext;
		let middy;
		let moduleMock;
		before(async () => {
			moduleMock = mock.module("@aws/durable-execution-sdk-js", {
				namedExports: { withDurableExecution: (fn) => fn },
			});
			({ executionModeDurableContext } = await import(
				"./executionModeDurableContext.js?mock=durable-passthrough"
			));
			({ middy } = await import("./index.js"));
		});
		after(() => {
			moduleMock.restore();
		});

		// The SDK exposes only `durableExecutionArn` under `executionContext`;
		// `tenantId` lives on the Lambda context (`lambdaContext`), where the SDK
		// itself reads it from.
		const baseContext = () => ({
			getRemainingTimeInMillis: () => 1000,
			executionContext: { durableExecutionArn: "arn:aws:lambda:::durable" },
			lambdaContext: {
				functionName: "fn-xyz",
				awsRequestId: "req-1",
				tenantId: "tenant-123",
			},
		});

		// L62/L63 - copyKeys copies the expected keys from the nested Lambda
		// context and does not over-iterate (no spurious `undefined` key).
		test("executionModeDurableContext copies lambda context keys to top level", async () => {
			let captured;
			const handler = middy({
				executionMode: executionModeDurableContext,
			}).handler((event, context) => {
				captured = {
					functionName: context.functionName,
					awsRequestId: context.awsRequestId,
					tenantId: context.tenantId,
					hasUndefinedKey: "undefined" in context,
				};
				return "ok";
			});

			const result = await handler({}, baseContext());

			strictEqual(result, "ok");
			// lambdaContextKeys copied, including tenantId
			strictEqual(captured.functionName, "fn-xyz");
			strictEqual(captured.awsRequestId, "req-1");
			strictEqual(captured.tenantId, "tenant-123");
			// No off-by-one over-iteration writing `to[keys[len]]` (an `undefined` key).
			strictEqual(captured.hasUndefinedKey, false);
		});

		test("executionModeDurableContext keeps the outer middyContext intact under a nested request", async () => {
			const seen = {};
			const inner = middy({
				executionMode: executionModeDurableContext,
			}).handler((event, context) => {
				seen.innerX = context.middyContext.x;
				return "ok";
			});
			const outer = middy((event, context) => inner(event, context))
				.before((request) => {
					request.context.middyContext.x = "outer";
				})
				.after((request) => {
					seen.outerIsOwn = Object.hasOwn(request.context.middyContext, "x");
				});

			await outer({}, baseContext());
			strictEqual(seen.innerX, "outer");
			strictEqual(seen.outerIsOwn, true);
		});

		// When both the handler and the requestEnd hook throw, both errors are
		// kept in an AggregateError (a middy error's cause:{package} is untouched).
		test("executionModeDurableContext throws AggregateError when handler and hook both throw", async () => {
			const handlerErr = new Error("handler failed", {
				cause: { package: "@middy/core" },
			});
			const hookErr = new Error("requestEnd failed");
			const handler = middy({
				executionMode: executionModeDurableContext,
				requestEnd: () => {
					throw hookErr;
				},
			}).handler(() => {
				throw handlerErr;
			});

			let caught;
			try {
				await handler({}, baseContext());
				throw new Error("Expected handler error to propagate");
			} catch (e) {
				caught = e;
			}
			ok(caught instanceof AggregateError);
			deepStrictEqual(caught.errors, [handlerErr, hookErr]);
			deepStrictEqual(handlerErr.cause, { package: "@middy/core" });
		});

		test("executionModeDurableContext rethrows the handler error when requestEnd succeeds", async () => {
			const handlerErr = new Error("handler failed");
			const handler = middy({
				executionMode: executionModeDurableContext,
				requestEnd: () => {},
			}).handler(() => {
				throw handlerErr;
			});

			let caught;
			try {
				await handler({}, baseContext());
				throw new Error("Expected handler error to propagate");
			} catch (e) {
				caught = e;
			}
			strictEqual(caught, handlerErr);
		});

		// When the handler succeeds but the requestEnd hook throws, the hook
		// error is thrown directly.
		test("executionModeDurableContext throws requestEnd hook error when handler succeeds", async () => {
			const hookErr = new Error("requestEnd failed");
			const handler = middy({
				executionMode: executionModeDurableContext,
				requestEnd: () => {
					throw hookErr;
				},
			}).handler(() => "ok");

			let caught;
			try {
				await handler({}, baseContext());
				throw new Error("Expected requestEnd hook error to propagate");
			} catch (e) {
				caught = e;
			}
			strictEqual(caught, hookErr);
		});

		// An async requestEnd hook returns a real Promise that must
		// be awaited. This also runs in executionModeDurableContext.test.js against
		// the real SDK; it is needed here too because this file's cache-busted
		// `?mock=` import is a second module instance whose (query-stripped)
		// coverage record is summed into the same file path by the coverage report.
		test("executionModeDurableContext awaits async requestEnd hook and propagates its rejection", async () => {
			const hookErr = new Error("requestEnd failed");
			const handler = middy({
				executionMode: executionModeDurableContext,
				requestEnd: async () => {
					throw hookErr;
				},
			}).handler(() => "ok");

			let caught;
			try {
				await handler({}, baseContext());
				throw new Error("Expected requestEnd hook error to propagate");
			} catch (e) {
				caught = e;
			}
			strictEqual(caught, hookErr);
		});
	});
});
