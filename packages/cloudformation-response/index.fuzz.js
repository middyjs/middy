import { deepStrictEqual, ok } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

const pkg = "@middy/cloudformation-response";

// CloudFormation only reads the PUT to event.ResponseURL, so delivery is
// stubbed: every body is accepted and nothing leaves the process.
let lastBody;
globalThis.fetch = async (_url, init) => {
	lastBody = init.body;
	return new Response(null, { status: 200 });
};

const handler = middy((event) => event).use(middleware());
// A Lambda context always names its log stream, which is the PhysicalResourceId
// fallback; without one the middleware raises a package error by design.
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
	logStreamName: "2026/03/14/[$LATEST]abcdef1234567890",
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			try {
				await handler(event, defaultContext);
			} catch (e) {
				// Only the package's own errors (an oversized body) may escape.
				const errors = e.errors ?? [e];
				if (!errors.every((err) => err.cause?.package === pkg)) {
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

test("fuzz Reason/Data of any size: delivered within 4096 bytes or reported FAILED", async () => {
	const event = {
		RequestType: "Create",
		RequestId: "RequestId",
		LogicalResourceId: "LogicalResourceId",
		StackId: "StackId",
		ResponseURL: "https://example.com/response?X-Amz-Signature=signature",
	};
	const custom = middy((event) => ({
		Reason: event.reason,
		Data: event.data,
	})).use(middleware());
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				reason: fc.string({ maxLength: 8000, unit: "grapheme" }),
				data: fc.dictionary(fc.string(), fc.string({ maxLength: 500 }), {
					maxKeys: 20,
				}),
			}),
			async ({ reason, data }) => {
				lastBody = undefined;
				const response = await custom(
					{ ...event, reason, data },
					defaultContext,
				);
				ok(["SUCCESS", "FAILED"].includes(response.Status));
				ok(Buffer.byteLength(lastBody) <= 4096);
				// What CloudFormation received is what the handler returned.
				deepStrictEqual(
					JSON.parse(lastBody),
					JSON.parse(JSON.stringify(response)),
				);
			},
		),
		{
			numRuns: 2_000,
			examples: [],
		},
	);
});
