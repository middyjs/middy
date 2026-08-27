import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

// Stands in for @middy/http-content-negotiation, which is where the middleware
// reads preferredEncoding from. Without it the fuzzer never reaches the encoder.
const seedPreferredEncoding = () => ({
	before: (request) => {
		request.context.middyContext["http-content-negotiation"] = {
			preferredEncoding: request.context.preferredEncoding,
		};
	},
});

const handler = middy((event) => event)
	.use(seedPreferredEncoding())
	.use(middleware());
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
	preferredEncoding: "br",
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			await handler(event, defaultContext);
		}),
		{
			numRuns: 10_000,

			examples: [],
		},
	);
});

test("fuzz `event` w/ `record`", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				body: fc.anything(),
			}),
			async (event) => {
				await handler(event, defaultContext);
			},
		),
		{
			numRuns: 10_000,

			examples: [],
		},
	);
});
