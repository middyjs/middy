import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

const defaultMethods = [
	{
		method: "tempo",
		recipient: "0x1234567890123456789012345678901234567890",
		currency: "0xabcdef0123456789012345678901234567890123",
		amount: 0.01,
	},
];

const handler = middy(() => ({ statusCode: 200 })).use(
	middleware({ methods: defaultMethods }),
);

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			await handler(event, defaultContext);
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
				headers: fc.object(),
			}),
			async (event) => {
				await handler(event, defaultContext);
			},
		),
		{
			numRuns: 100_000,
			examples: [],
		},
	);
});

test("fuzz `Authorization` header value", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				headers: fc.record({
					Authorization: fc.oneof(
						fc.constant(undefined),
						fc.constant("MPP "),
						fc.string().map((s) => `MPP ${s}`),
						fc.string(),
					),
				}),
			}),
			async (event) => {
				await handler(event, defaultContext);
			},
		),
		{
			numRuns: 100_000,
			examples: [],
		},
	);
});
