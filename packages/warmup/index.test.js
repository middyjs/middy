import { ok, strictEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import middy from "../core/index.js";
import warmup, { warmupValidateOptions } from "./index.js";

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const thenKey = "then";

describe("@middy/warmup", () => {
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

	test("Should not exit with 'warmup' if the event is null", async (t) => {
		const handler = middy(() => "executed");

		handler.use(warmup());

		const response = await handler(null, defaultContext);

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

	test("Should execute handler when an async isWarmingUp resolves false", async (t) => {
		const handler = middy(() => "executed").use(
			warmup({ isWarmingUp: async () => false }),
		);

		const response = await handler(defaultEvent, defaultContext);

		strictEqual(response, "executed");
	});

	test("Should exit with 'warmup' when an async isWarmingUp resolves true", async (t) => {
		const lambdaHandler = t.mock.fn(() => "executed");
		const handler = middy(lambdaHandler).use(
			warmup({ isWarmingUp: async () => true }),
		);

		const response = await handler(defaultEvent, defaultContext);

		strictEqual(response, "warmup");
		strictEqual(lambdaHandler.mock.callCount(), 0);
	});

	test("Should execute handler when isWarmingUp returns a truthy value other than true", async (t) => {
		for (const result of [1, "yes", {}, []]) {
			const handler = middy(() => "executed").use(
				warmup({ isWarmingUp: () => result }),
			);
			strictEqual(await handler(defaultEvent, defaultContext), "executed");

			const asyncHandler = middy(() => "executed").use(
				warmup({ isWarmingUp: async () => result }),
			);
			strictEqual(await asyncHandler(defaultEvent, defaultContext), "executed");
		}
	});

	test("Should execute handler when isWarmingUp returns nothing", async (t) => {
		for (const result of [undefined, null]) {
			const handler = middy(() => "executed").use(
				warmup({ isWarmingUp: () => result }),
			);
			strictEqual(await handler(defaultEvent, defaultContext), "executed");
		}
	});

	test("Should await a thenable returned by isWarmingUp", async (t) => {
		const thenable = (value) => ({ [thenKey]: (resolve) => resolve(value) });
		const warm = middy(() => "executed").use(
			warmup({ isWarmingUp: () => thenable(true) }),
		);
		strictEqual(await warm(defaultEvent, defaultContext), "warmup");

		const cold = middy(() => "executed").use(
			warmup({ isWarmingUp: () => thenable(false) }),
		);
		strictEqual(await cold(defaultEvent, defaultContext), "executed");
	});

	test("Should pass the rejection of an async isWarmingUp to the caller", async (t) => {
		const error = new Error("check failed");
		const handler = middy(() => "executed").use(
			warmup({
				isWarmingUp: async () => {
					throw error;
				},
			}),
		);

		await t.assert.rejects(handler(defaultEvent, defaultContext), (e) => {
			strictEqual(e, error);
			return true;
		});
	});

	test("Should keep the hook synchronous for a synchronous isWarmingUp", (t) => {
		strictEqual(
			warmup({ isWarmingUp: () => true }).before({ event: defaultEvent }),
			"warmup",
		);
		strictEqual(
			warmup({ isWarmingUp: () => false }).before({ event: defaultEvent }),
			undefined,
		);
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
});
