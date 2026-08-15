import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import middy from "../core/index.js";
import httpX402 from "./index.js";

class AlwaysInvalidFacilitatorClient {
	async verify() {
		return { isValid: false, invalidReason: "invalid_payload" };
	}
	async settle() {
		return { success: false, errorReason: "unexpected_settle_error" };
	}
}

const fuzzOptions = {
	price: 0.001,
	payTo: "0xpayto",
	asset: "0xasset",
	FacilitatorClient: AlwaysInvalidFacilitatorClient,
};
const defaultContext = { getRemainingTimeInMillis: () => 1000 };

test("fuzz payment-signature header values never crash", async () => {
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402(fuzzOptions),
	);

	await fc.assert(
		fc.asyncProperty(fc.string(), async (headerValue) => {
			const response = await handler(
				{ headers: { "payment-signature": headerValue } },
				defaultContext,
			);
			strictEqual(typeof response.statusCode, "number");
		}),
		{ numRuns: 10_000, examples: [] },
	);
});

test("fuzz arbitrary event objects never crash", async () => {
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402(fuzzOptions),
	);

	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			const response = await handler(event, defaultContext);
			strictEqual(typeof response.statusCode, "number");
		}),
		{ numRuns: 10_000, examples: [] },
	);
});
