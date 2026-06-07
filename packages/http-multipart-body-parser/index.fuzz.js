import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

const handler = middy((event) => event).use(middleware());
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			try {
				await handler(event, defaultContext);
			} catch (e) {
				if (e.cause?.package !== "@middy/http-multipart-body-parser") {
					throw e;
				}
			}
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
				headers: fc.record({
					"content-type": fc.constant("multipart/form-data; boundary="),
				}),
				body: fc.string(),
			}),
			async (event) => {
				try {
					await handler(event, defaultContext);
				} catch (e) {
					if (e.cause?.package !== "@middy/http-multipart-body-parser") {
						throw e;
					}
				}
			},
		),
		{
			numRuns: 10_000,

			examples: [],
		},
	);
});

// Stress bracket-heavy / oversized field names through a well-formed multipart
// body to ensure linear-time parsing and that any rejection is normalized.
test("fuzz bracket-heavy multipart field names", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.tuple(
				fc
					.array(fc.constantFrom("a", "[", "]"), {
						minLength: 0,
						maxLength: 2000,
					})
					.map((chars) => chars.join("")),
				fc.string(),
			),
			async ([fieldname, value]) => {
				const safeName = fieldname.replaceAll('"', "");
				const event = {
					headers: { "content-type": "multipart/form-data; boundary=TEST" },
					body: `--TEST\r\nContent-Disposition: form-data; name="${safeName}"\r\n\r\n${value}\r\n--TEST--`,
					isBase64Encoded: false,
				};
				try {
					await handler(event, defaultContext);
				} catch (e) {
					if (e.cause?.package !== "@middy/http-multipart-body-parser") {
						throw e;
					}
				}
			},
		),
		{
			numRuns: 2_000,

			examples: [],
		},
	);
});
