import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

global.fetch = () =>
	Promise.resolve(
		new Response(JSON.stringify({ option: "value" }), {
			status: 200,
			statusText: "OK",
			headers: new Headers({
				"Content-Type": "application/json; charset=UTF-8",
			}),
		}),
	);

const handler = middy((event) => event).use(
	middleware({
		fetchData: {
			key: { application: "app", environment: "dev", configuration: "cfg" },
		},
		cacheExpiry: 0,
		disablePrefetch: true,
	}),
);
const context = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			await handler(event, context);
		}),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});
