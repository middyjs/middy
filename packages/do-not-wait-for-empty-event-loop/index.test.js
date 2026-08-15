import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import doNotWaitForEmptyEventLoop, {
	doNotWaitForEmptyEventLoopValidateOptions,
} from "./index.js";

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should set callbackWaitsForEmptyEventLoop to false by default (executionModeStandard)", async (t) => {
	const handler = middy()
		.use(doNotWaitForEmptyEventLoop())
		.handler((event, context) => {});

	const context = { ...defaultContext };
	await handler(defaultEvent, context);

	ok(!context.callbackWaitsForEmptyEventLoop);
});

test("callbackWaitsForEmptyEventLoop should remain true if was overridden by user in handler (executionModeStandard)", async (t) => {
	const handler = middy()
		.use(doNotWaitForEmptyEventLoop())
		.handler((event, context) => {
			context.callbackWaitsForEmptyEventLoop = true;
		});

	const context = { ...defaultContext };
	await handler(defaultEvent, context);

	ok(context.callbackWaitsForEmptyEventLoop);
});

test("callbackWaitsForEmptyEventLoop should stay false if handler has error (executionModeStandard)", async (t) => {
	const handler = middy()
		.use(doNotWaitForEmptyEventLoop())
		.handler((event, context) => {
			throw new Error("!");
		});

	const context = { ...defaultContext };

	try {
		await handler(defaultEvent, context);
	} catch (_e) {
		ok(!context.callbackWaitsForEmptyEventLoop);
	}
});

test("callbackWaitsForEmptyEventLoop should be false when runOnAfter is true in options (executionModeStandard)", async (t) => {
	const handler = middy()
		.use(
			doNotWaitForEmptyEventLoop({
				runOnAfter: true,
			}),
		)
		.handler((event, context) => {
			context.callbackWaitsForEmptyEventLoop = true;
		});

	const context = { ...defaultContext };
	await handler(defaultEvent, context);

	ok(!context.callbackWaitsForEmptyEventLoop);
});

test("callbackWaitsForEmptyEventLoop should remain true when error occurs even if runOnAfter is true (executionModeStandard)", async (t) => {
	const handler = middy()
		.use(
			doNotWaitForEmptyEventLoop({
				runOnAfter: true,
			}),
		)
		.handler((event, context) => {
			context.callbackWaitsForEmptyEventLoop = true;
			throw new Error("!");
		});

	const context = { ...defaultContext };
	try {
		await handler(defaultEvent, context);
	} catch (_e) {
		ok(context.callbackWaitsForEmptyEventLoop);
	}
});

test("callbackWaitsForEmptyEventLoop should be false when error occurs but runOnError is true (executionModeStandard)", async (t) => {
	const handler = middy()
		.use(
			doNotWaitForEmptyEventLoop({
				runOnAfter: true,
				runOnError: true,
			}),
		)
		.handler((event, context) => {
			context.callbackWaitsForEmptyEventLoop = true;
			throw new Error("!");
		});

	const context = { ...defaultContext };
	try {
		await handler(defaultEvent, context);
	} catch (_e) {
		ok(!context.callbackWaitsForEmptyEventLoop);
	}
});

test("thrown error should be propagated when it occurs & runOnError is true (executionModeStandard)", async (t) => {
	const handler = middy()
		.use(
			doNotWaitForEmptyEventLoop({
				runOnAfter: true,
				runOnError: true,
			}),
		)
		.handler((event, context) => {
			context.callbackWaitsForEmptyEventLoop = true;
			throw new Error("!");
		});

	const context = { ...defaultContext };
	try {
		await handler(defaultEvent, context);
	} catch (error) {
		strictEqual(error.message, "!");
	}
});

test("callbackWaitsForEmptyEventLoop should be false in handler but true after if set by options (executionModeStandard)", async (t) => {
	const handler = middy()
		.use(
			doNotWaitForEmptyEventLoop({
				runOnBefore: false,
				runOnAfter: true,
			}),
		)
		.handler((event, context) => {
			ok(context.callbackWaitsForEmptyEventLoop);
		});

	const context = { ...defaultContext, callbackWaitsForEmptyEventLoop: true };
	await handler(defaultEvent, context);

	ok(!context.callbackWaitsForEmptyEventLoop);
});

class DurableContextImpl {
	[Symbol.for("@aws/durable-execution-sdk-js/durable-context")] = true;
	constructor(props = {}) {
		Object.assign(this, props);
	}
	async step(_id, fn) {
		return fn(this);
	}
	async runInChildContext(_id, fn) {
		return fn(this);
	}
}

const makeDurableContext = (overrides = {}) =>
	new DurableContextImpl({
		lambdaContext: { ...defaultContext, ...(overrides.lambdaContext ?? {}) },
	});

test("It should set callbackWaitsForEmptyEventLoop to false by default (executionModeDurableContext)", async (t) => {
	const handler = middy()
		.use(doNotWaitForEmptyEventLoop())
		.handler((event, context) => {});

	const context = makeDurableContext();
	await handler(defaultEvent, context);

	ok(!context.lambdaContext.callbackWaitsForEmptyEventLoop);
});

test("callbackWaitsForEmptyEventLoop should remain true if was overridden by user in handler (executionModeDurableContext)", async (t) => {
	const handler = middy()
		.use(doNotWaitForEmptyEventLoop())
		.handler((event, context) => {
			context.lambdaContext.callbackWaitsForEmptyEventLoop = true;
		});

	const context = makeDurableContext();
	await handler(defaultEvent, context);

	ok(context.lambdaContext.callbackWaitsForEmptyEventLoop);
});

test("callbackWaitsForEmptyEventLoop should stay false if handler has error (executionModeDurableContext)", async (t) => {
	const handler = middy()
		.use(doNotWaitForEmptyEventLoop())
		.handler((event, context) => {
			throw new Error("!");
		});

	const context = makeDurableContext();

	try {
		await handler(defaultEvent, context);
	} catch (_e) {
		ok(!context.lambdaContext.callbackWaitsForEmptyEventLoop);
	}
});

test("callbackWaitsForEmptyEventLoop should be false when runOnAfter is true in options (executionModeDurableContext)", async (t) => {
	const handler = middy()
		.use(
			doNotWaitForEmptyEventLoop({
				runOnAfter: true,
			}),
		)
		.handler((event, context) => {
			context.lambdaContext.callbackWaitsForEmptyEventLoop = true;
		});

	const context = makeDurableContext();
	await handler(defaultEvent, context);

	ok(!context.lambdaContext.callbackWaitsForEmptyEventLoop);
});

test("callbackWaitsForEmptyEventLoop should remain true when error occurs even if runOnAfter is true (executionModeDurableContext)", async (t) => {
	const handler = middy()
		.use(
			doNotWaitForEmptyEventLoop({
				runOnAfter: true,
			}),
		)
		.handler((event, context) => {
			context.lambdaContext.callbackWaitsForEmptyEventLoop = true;
			throw new Error("!");
		});

	const context = makeDurableContext();
	try {
		await handler(defaultEvent, context);
	} catch (_e) {
		ok(context.lambdaContext.callbackWaitsForEmptyEventLoop);
	}
});

test("callbackWaitsForEmptyEventLoop should be false when error occurs but runOnError is true (executionModeDurableContext)", async (t) => {
	const handler = middy()
		.use(
			doNotWaitForEmptyEventLoop({
				runOnAfter: true,
				runOnError: true,
			}),
		)
		.handler((event, context) => {
			context.lambdaContext.callbackWaitsForEmptyEventLoop = true;
			throw new Error("!");
		});

	const context = makeDurableContext();
	try {
		await handler(defaultEvent, context);
	} catch (_e) {
		ok(!context.lambdaContext.callbackWaitsForEmptyEventLoop);
	}
});

test("thrown error should be propagated when it occurs & runOnError is true (executionModeDurableContext)", async (t) => {
	const handler = middy()
		.use(
			doNotWaitForEmptyEventLoop({
				runOnAfter: true,
				runOnError: true,
			}),
		)
		.handler((event, context) => {
			context.lambdaContext.callbackWaitsForEmptyEventLoop = true;
			throw new Error("!");
		});

	const context = makeDurableContext();
	try {
		await handler(defaultEvent, context);
	} catch (error) {
		strictEqual(error.message, "!");
	}
});

test("callbackWaitsForEmptyEventLoop should be false in handler but true after if set by options (executionModeDurableContext)", async (t) => {
	const handler = middy()
		.use(
			doNotWaitForEmptyEventLoop({
				runOnBefore: false,
				runOnAfter: true,
			}),
		)
		.handler((event, context) => {
			ok(context.lambdaContext.callbackWaitsForEmptyEventLoop);
		});

	const context = makeDurableContext({
		lambdaContext: { callbackWaitsForEmptyEventLoop: true },
	});
	await handler(defaultEvent, context);

	ok(!context.lambdaContext.callbackWaitsForEmptyEventLoop);
});

test("doNotWaitForEmptyEventLoopValidateOptions accepts valid options and rejects typos", () => {
	doNotWaitForEmptyEventLoopValidateOptions({
		runOnBefore: true,
		runOnAfter: false,
	});
	doNotWaitForEmptyEventLoopValidateOptions({});
	try {
		doNotWaitForEmptyEventLoopValidateOptions({ runBefore: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/do-not-wait-for-empty-event-loop");
	}
});

test("doNotWaitForEmptyEventLoopValidateOptions rejects wrong type", () => {
	try {
		doNotWaitForEmptyEventLoopValidateOptions({ runOnBefore: "yes" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("runOnBefore"));
	}
});

test("doNotWaitForEmptyEventLoopValidateOptions accepts boolean runOnError", () => {
	doNotWaitForEmptyEventLoopValidateOptions({ runOnError: false });
	doNotWaitForEmptyEventLoopValidateOptions({ runOnError: true });
});

test("doNotWaitForEmptyEventLoopValidateOptions rejects non-boolean runOnError", () => {
	try {
		doNotWaitForEmptyEventLoopValidateOptions({ runOnError: "yes" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.message, "Option 'runOnError' must be boolean");
	}
});
