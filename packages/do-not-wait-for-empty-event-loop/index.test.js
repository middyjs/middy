import { equal, ok } from "node:assert/strict";
import { test } from "node:test";
// import { LocalDurableTestRunner } from "@aws/durable-execution-sdk-js-testing";
import middy from "../core/index.js";
// import {lambdaContext} from '../util/index.js'
import doNotWaitForEmptyEventLoop from "./index.js";

const event = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should set callbackWaitsForEmptyEventLoop to false by default (executionModeStandard)", async (t) => {
	const handler = middy()
		.use(doNotWaitForEmptyEventLoop())
		.handler((event, context) => {});

	const context = { ...defaultContext };
	await handler(event, context);

	ok(!context.callbackWaitsForEmptyEventLoop);
});

test("callbackWaitsForEmptyEventLoop should remain true if was overridden by user in handler (executionModeStandard)", async (t) => {
	const handler = middy()
		.use(doNotWaitForEmptyEventLoop())
		.handler((event, context) => {
			context.callbackWaitsForEmptyEventLoop = true;
		});

	const context = { ...defaultContext };
	await handler(event, context);

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
		await handler(event, context);
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
	await handler(event, context);

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
		await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
	} catch (error) {
		equal(error.message, "!");
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
	await handler(event, context);

	ok(!context.callbackWaitsForEmptyEventLoop);
});

const defaultDurableContext = {
	lambdaContext: {
		...defaultContext,
	},
	// mock Class
	constructor: {
		name: "DurableContextImpl",
	},
};

test("It should set callbackWaitsForEmptyEventLoop to false by default (executionModeDurableContext)", async (t) => {
	const handler = middy()
		.use(doNotWaitForEmptyEventLoop())
		.handler((event, context) => {});

	const context = { ...defaultDurableContext };
	await handler(event, context);

	ok(!context.lambdaContext.callbackWaitsForEmptyEventLoop);
});

test("callbackWaitsForEmptyEventLoop should remain true if was overridden by user in handler (executionModeDurableContext)", async (t) => {
	const handler = middy()
		.use(doNotWaitForEmptyEventLoop())
		.handler((event, context) => {
			context.lambdaContext.callbackWaitsForEmptyEventLoop = true;
		});

	const context = { ...defaultDurableContext };
	await handler(event, context);

	ok(context.lambdaContext.callbackWaitsForEmptyEventLoop);
});

test("callbackWaitsForEmptyEventLoop should stay false if handler has error (executionModeDurableContext)", async (t) => {
	const handler = middy()
		.use(doNotWaitForEmptyEventLoop())
		.handler((event, context) => {
			throw new Error("!");
		});

	const context = { ...defaultDurableContext };

	try {
		await handler(event, context);
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

	const context = { ...defaultDurableContext };
	await handler(event, context);

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

	const context = { ...defaultDurableContext };
	try {
		await handler(event, context);
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

	const context = { ...defaultDurableContext };
	try {
		await handler(event, context);
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

	const context = { ...defaultDurableContext };
	try {
		await handler(event, context);
	} catch (error) {
		equal(error.message, "!");
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

	const context = {
		...defaultDurableContext,
		lambdaContext: {
			...defaultDurableContext.lambdaContext,
			callbackWaitsForEmptyEventLoop: true,
		},
	};
	await handler(event, context);

	ok(!context.lambdaContext.callbackWaitsForEmptyEventLoop);
});
