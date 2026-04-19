import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import router from "./index.js";

const handler = middy(router());
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			try {
				await handler(event, defaultContext);
			} catch (e) {
				if (e.cause?.package !== "@middy/ws-router") {
					throw e;
				}
			}
		}),
		{
			numRuns: 100_000,
			examples: [],
		},
	);
});

test("fuzz `event` w/ `record`", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				requestContext: fc.record({
					routeKey: fc.string(),
				}),
			}),
			async (event) => {
				try {
					await handler(event, defaultContext);
				} catch (e) {
					if (e.cause?.package !== "@middy/ws-router") {
						throw e;
					}
				}
			},
		),
		{
			numRuns: 100_000,
			examples: [[{ requestContext: { routeKey: "valueOf" } }]],
		},
	);
});

test("fuzz valid routeKey routes correctly", async () => {
	const routeHandler = middy(
		router([
			{ routeKey: "$connect", handler: () => "connect" },
			{ routeKey: "$disconnect", handler: () => "disconnect" },
			{ routeKey: "message", handler: () => "message" },
		]),
	);
	await fc.assert(
		fc.asyncProperty(
			fc.constantFrom("$connect", "$disconnect", "message"),
			async (routeKey) => {
				const event = { requestContext: { routeKey } };
				const result = await routeHandler(event, defaultContext);
				strictEqual(typeof result, "string");
			},
		),
		{
			numRuns: 100_000,
			examples: [],
		},
	);
});
