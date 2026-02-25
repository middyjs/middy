import { test } from "node:test";
import fc from "fast-check";

test("fuzz `event` w/ `object`", async (t) => {
	t.mock.module("aws-embedded-metrics", {
		namedExports: {
			createMetricsLogger: () => ({
				setNamespace: () => {},
				setDimensions: () => {},
				flush: async () => {},
			}),
		},
	});

	const { default: middy } = await import("../core/index.js");
	const { default: middleware } = await import("./index.js");

	const handler = middy((event) => event).use(middleware());
	const defaultContext = {
		getRemainingTimeInMillis: () => 1000,
	};

	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			await handler(event, defaultContext);
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});
