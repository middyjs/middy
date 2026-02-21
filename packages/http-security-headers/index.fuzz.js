import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

const webPathWithQuery = fc
	.webUrl({
		authoritySettings: {
			host: fc.constant("example.com"),
			port: fc.constant(undefined),
		},
		withQueryParameters: true,
		withFragments: false,
	})
	.map((url) => {
		try {
			const parsed = new URL(url);
			return parsed.pathname + parsed.search;
		} catch {
			return "/";
		}
	});

const handler = middy((event) => event).use(middleware());
const context = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
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

test("fuzz `event` w/ `record` ({version: '1.0'})", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				httpMethod: fc.constantFrom(
					"HEAD",
					"OPTIONS",
					"GET",
					"POST",
					"PATCH",
					"DELETE",
					"TRACE",
					"CONNECT",
				),
				path: fc.webPath(),
			}),
			async (event) => {
				try {
					await handler(event, context);
				} catch (e) {
					if (e.cause?.package !== "@middy/http-security-headers") {
						throw e;
					}
				}
			},
		),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});

test("fuzz `event` w/ `record` ({version: '2.0'})", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				version: fc.constant("2.0"),
				requestContext: fc.record({
					http: fc.record({
						method: fc.constantFrom(
							"HEAD",
							"OPTIONS",
							"GET",
							"POST",
							"PATCH",
							"DELETE",
							"TRACE",
							"CONNECT",
						),
						path: fc.webPath(),
					}),
				}),
			}),
			async (event) => {
				try {
					await handler(event, context);
				} catch (e) {
					if (e.cause?.package !== "@middy/http-security-headers") {
						throw e;
					}
				}
			},
		),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});

test("fuzz `event` w/ `record` ({version: 'vpc'})", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				method: fc.constantFrom(
					"HEAD",
					"OPTIONS",
					"GET",
					"POST",
					"PATCH",
					"DELETE",
					"TRACE",
					"CONNECT",
				),
				raw_path: webPathWithQuery,
			}),
			async (event) => {
				try {
					await handler(event, context);
				} catch (e) {
					if (e.cause?.package !== "@middy/http-security-headers") {
						throw e;
					}
				}
			},
		),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});
