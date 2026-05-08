import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";

import middy from "../core/index.js";
import warmup, { warmupValidateOptions } from "./index.js";

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("Should exit with 'warmup' if provided warmup check function is provide and returns true", async (t) => {
	const handler = middy(() => {});

	handler.use(
		warmup({
			isWarmingUp: () => true,
		}),
	);

	const response = await handler(defaultEvent, defaultContext);

	strictEqual(response, "warmup");
});

test("Should exit not with 'warmup' if provided warmup check function is provide and returns false", async (t) => {
	const handler = middy(() => {});

	handler.use(
		warmup({
			isWarmingUp: () => false,
		}),
	);

	const response = await handler(defaultEvent, defaultContext);

	strictEqual(response, undefined);
});

test("Should exit with 'warmup' if event.source === 'serverless-plugin-warmup' if no warmup check function provided", async (t) => {
	const handler = middy(() => {});

	handler.use(warmup());

	const event = {
		source: "serverless-plugin-warmup",
	};
	const response = await handler(event, defaultContext);

	strictEqual(response, "warmup");
});

test("Should not exit with 'warmup' if event.source !== 'serverless-plugin-warmup' if no warmup check function provided", async (t) => {
	const handler = middy(() => {});

	handler.use(warmup());

	const event = {
		source: "warmup",
	};
	const response = await handler(event, defaultContext);

	strictEqual(response, undefined);
});

test("Should not exit with 'warmup' if event has no source property", async (t) => {
	const handler = middy(() => "executed");

	handler.use(warmup());

	const response = await handler({}, defaultContext);

	strictEqual(response, "executed");
});

test("Should execute handler normally when not warming up", async (t) => {
	let handlerCalled = false;
	const handler = middy(() => {
		handlerCalled = true;
		return "result";
	});

	handler.use(warmup());

	const response = await handler({ source: "other" }, defaultContext);

	strictEqual(handlerCalled, true);
	strictEqual(response, "result");
});

test("Should not execute handler when warming up", async (t) => {
	let handlerCalled = false;
	const handler = middy(() => {
		handlerCalled = true;
		return "result";
	});

	handler.use(warmup());

	const response = await handler(
		{ source: "serverless-plugin-warmup" },
		defaultContext,
	);

	strictEqual(handlerCalled, false);
	strictEqual(response, "warmup");
});

test("Should pass event to custom isWarmingUp function", async (t) => {
	let receivedEvent;
	const handler = middy(() => {});

	handler.use(
		warmup({
			isWarmingUp: (event) => {
				receivedEvent = event;
				return event.warmup === true;
			},
		}),
	);

	const event = { warmup: true, extra: "data" };
	const response = await handler(event, defaultContext);

	strictEqual(response, "warmup");
	strictEqual(receivedEvent, event);
});

test("warmupValidateOptions accepts valid options and rejects typos", () => {
	warmupValidateOptions({ isWarmingUp: () => true });
	warmupValidateOptions({});
	try {
		warmupValidateOptions({ isWarming: () => true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/warmup");
	}
});

test("warmupValidateOptions rejects wrong type", () => {
	try {
		warmupValidateOptions({ isWarmingUp: "yes" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("isWarmingUp"));
	}
});
