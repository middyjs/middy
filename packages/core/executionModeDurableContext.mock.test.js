import { ok, strictEqual } from "node:assert/strict";
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

	const baseContext = () => ({
		getRemainingTimeInMillis: () => 1000,
		executionContext: { tenantId: "tenant-123" },
		lambdaContext: { functionName: "fn-xyz", awsRequestId: "req-1" },
	});

	// L62/L63 - copyKeys copies the expected keys from nested contexts and does
	// not over-iterate (no spurious `undefined` key).
	test("executionModeDurableContext copies lambda/execution context keys to top level", async () => {
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
		// lambdaContextKeys copied
		strictEqual(captured.functionName, "fn-xyz");
		strictEqual(captured.awsRequestId, "req-1");
		// executionContextKeys copied
		strictEqual(captured.tenantId, "tenant-123");
		// No off-by-one over-iteration writing `to[keys[len]]` (an `undefined` key).
		strictEqual(captured.hasUndefinedKey, false);
	});

	// L46/L47 - when both handler and requestEnd hook throw, the handler error is
	// thrown with the hook error attached as its (previously unset) cause.
	test("executionModeDurableContext attaches hook error as cause of handler error", async () => {
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

		let caught;
		try {
			await handler({}, baseContext());
			throw new Error("Expected handler error to propagate");
		} catch (e) {
			caught = e;
		}
		strictEqual(caught, handlerErr);
		strictEqual(caught.cause, hookErr);
	});

	// L49/L50 - when the handler succeeds but the requestEnd hook throws, the hook
	// error is thrown directly (no handler error to attach it to).
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

	// L46 true-arm - an async requestEnd hook returns a real Promise that must
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

	// L47 - `??=` must not overwrite an already-set cause when the hook also throws.
	test("executionModeDurableContext preserves existing handler error cause when hook throws", async () => {
		const existingCause = new Error("pre-existing");
		const handlerErr = new Error("handler failed", { cause: existingCause });
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
		strictEqual(caught, handlerErr);
		strictEqual(caught.cause, existingCause);
		ok(caught.cause !== hookErr);
	});
});
