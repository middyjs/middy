import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

const client = () => ({ end: async () => {} });

const handler = middy((event) => event).use(
	middleware({
		client,
		config: { host: "cluster.dsql.us-east-1.on.aws" },
	}),
);

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			await handler(event, { ...defaultContext });
		}),
		{
			numRuns: 100_000,
			examples: [],
		},
	);
});
