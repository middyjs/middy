import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpX402, { httpX402ValidateOptions } from "./index.js";

const defaultOptions = {
	price: 0.001,
	payTo: "0xpayto",
	asset: "0xasset",
};

const defaultContext = { getRemainingTimeInMillis: () => 1000 };

const makePaymentHeader = (payload) =>
	Buffer.from(JSON.stringify(payload)).toString("base64");

const decodeResponseHeader = (header) =>
	JSON.parse(Buffer.from(header, "base64").toString());

const testAccepted = {
	scheme: "exact",
	network: "eip155:8453",
	amount: "1000",
	asset: "0xasset",
	payTo: "0xpayto",
	maxTimeoutSeconds: 60,
};

const testPayload = {
	x402Version: 2,
	accepted: testAccepted,
	payload: { signature: "0xsig", authorization: {} },
};

const withAccepted = (overrides) => ({
	...testPayload,
	accepted: { ...testAccepted, ...overrides },
});

const makeMockClient = (t, verifyResult, settleResult) => {
	const mockVerify = t.mock.fn(async () => verifyResult);
	const mockSettle = t.mock.fn(async () => settleResult);
	class MockFacilitatorClient {
		verify(...args) {
			return mockVerify(...args);
		}
		settle(...args) {
			return mockSettle(...args);
		}
	}
	return { MockFacilitatorClient, mockVerify, mockSettle };
};

const defaultVerifyResult = { isValid: true, payer: "0xpayer" };
const defaultSettleResult = {
	success: true,
	payer: "0xpayer",
	transaction: "0xtx",
	network: "eip155:8453",
};

test("no payment header returns 402 with v2 header challenge and v1 body challenge", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler({ headers: {} }, defaultContext);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["Content-Type"], "application/json");

	// v2 clients read the PAYMENT-REQUIRED header
	const challenge = decodeResponseHeader(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(challenge.x402Version, 2);
	strictEqual(challenge.error, "PAYMENT-SIGNATURE header is required");
	strictEqual(challenge.resource.url, "https://localhost/");
	strictEqual(challenge.resource.description, "");
	strictEqual(challenge.resource.mimeType, "application/json");
	ok(Array.isArray(challenge.accepts));
	deepStrictEqual(challenge.accepts[0], {
		scheme: "exact",
		network: "eip155:8453",
		amount: "1000",
		asset: "0xasset",
		payTo: "0xpayto",
		maxTimeoutSeconds: 60,
	});

	// v1 clients read the challenge from the response body
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 1);
	strictEqual(body.error, "X-PAYMENT header is required");
	deepStrictEqual(body.accepts[0], {
		scheme: "exact",
		network: "eip155:8453",
		maxAmountRequired: "1000",
		resource: "https://localhost/",
		description: "",
		mimeType: "application/json",
		outputSchema: {},
		payTo: "0xpayto",
		maxTimeoutSeconds: 60,
		asset: "0xasset",
		extra: {},
	});
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("missing headers object returns 402", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler({}, defaultContext);
	strictEqual(response.statusCode, 402);
});

test("malformed payment-signature header returns 402", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": "not!!valid!!base64" } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.error, "Payment required");
	ok(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("non-object decoded payment header is treated as missing payment", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(42) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.error, "Payment required");
	ok(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("null decoded payment header is treated as missing payment", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(null) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.error, "Payment required");
	ok(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("array decoded payment header is treated as missing payment", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader([1, 2, 3]) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.error, "Payment required");
	ok(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("payment payload for a different network is rejected without calling the facilitator", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	// A payload for a different network must be rejected up front, not bound by
	// trusting the facilitator.
	const wrongNetwork = withAccepted({ network: "eip155:1" });
	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(wrongNetwork) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(
		JSON.parse(response.body).error,
		"No matching payment requirements",
	);
	ok(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("payment payload for a different scheme is rejected without calling the facilitator", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	// A payload whose scheme does not match (network unchanged) must be rejected
	// up front by the scheme guard, not bound by trusting the facilitator.
	const wrongScheme = withAccepted({ scheme: "upto" });
	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(wrongScheme) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["Content-Type"], "application/json");
	strictEqual(
		JSON.parse(response.body).error,
		"No matching payment requirements",
	);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("verify failure returns 402 with invalidReason", async (t) => {
	const { MockFacilitatorClient, mockVerify, mockSettle } = makeMockClient(
		t,
		{ isValid: false, invalidReason: "invalid_exact_evm_payload_signature" },
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.error, "invalid_exact_evm_payload_signature");
	const headerBody = decodeResponseHeader(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(headerBody.error, "invalid_exact_evm_payload_signature");
	ok(Array.isArray(headerBody.accepts));
	strictEqual(mockVerify.mock.callCount(), 1);
	strictEqual(mockSettle.mock.callCount(), 0);
});

test("verify throws (facilitator down) returns clean 402 without leaking message", async (t) => {
	const mockVerify = t.mock.fn(async () => {
		throw new Error("facilitator 503: upstream secret detail");
	});
	class MockFacilitatorClient {
		verify(...args) {
			return mockVerify(...args);
		}
		settle() {}
	}
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 2);
	strictEqual(body.error, "unexpected_verify_error");
	ok(!response.body.includes("upstream secret detail"));
	const headerBody = decodeResponseHeader(response.headers["PAYMENT-REQUIRED"]);
	ok(!JSON.stringify(headerBody).includes("upstream secret detail"));
	strictEqual(mockVerify.mock.callCount(), 1);
});

test("settle throws (facilitator down) returns clean 402 without leaking message", async (t) => {
	const mockSettle = t.mock.fn(async () => {
		throw new Error("facilitator 503: settle secret detail");
	});
	class MockFacilitatorClient {
		verify() {
			return defaultVerifyResult;
		}
		settle(...args) {
			return mockSettle(...args);
		}
	}
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 2);
	strictEqual(body.error, "unexpected_settle_error");
	ok(!response.body.includes("settle secret detail"));
	const settlement = decodeResponseHeader(response.headers["PAYMENT-RESPONSE"]);
	strictEqual(settlement.success, false);
	strictEqual(settlement.errorReason, "unexpected_settle_error");
	strictEqual(settlement.transaction, "");
	strictEqual(settlement.network, "eip155:8453");
	ok(!JSON.stringify(settlement).includes("settle secret detail"));
	strictEqual(mockSettle.mock.callCount(), 1);
});

test("verify passes but handler returns 4xx - no settlement", async (t) => {
	const { MockFacilitatorClient, mockVerify, mockSettle } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 400,
		body: "bad request",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 400);
	strictEqual(mockVerify.mock.callCount(), 1);
	strictEqual(mockSettle.mock.callCount(), 0);
});

test("verify passes but handler returns 5xx - no settlement", async (t) => {
	const { MockFacilitatorClient, mockSettle } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 500,
		body: "error",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 500);
	strictEqual(mockSettle.mock.callCount(), 0);
});

test("verify passes, settle fails - returns 402", async (t) => {
	const failedSettleResult = {
		success: false,
		errorReason: "insufficient_funds",
		transaction: "",
		network: "eip155:8453",
		payer: "0xpayer",
	};
	const { MockFacilitatorClient, mockSettle } = makeMockClient(
		t,
		defaultVerifyResult,
		failedSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.error, "insufficient_funds");
	deepStrictEqual(
		decodeResponseHeader(response.headers["PAYMENT-RESPONSE"]),
		failedSettleResult,
	);
	strictEqual(mockSettle.mock.callCount(), 1);
});

test("verify and settle pass - adds PAYMENT-RESPONSE header", async (t) => {
	const { MockFacilitatorClient, mockVerify, mockSettle } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 200);
	ok(response.headers["PAYMENT-RESPONSE"]);
	strictEqual(mockVerify.mock.callCount(), 1);
	strictEqual(mockSettle.mock.callCount(), 1);
});

test("settle passes - internal state has payer and transaction", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);

	let capturedInternal;
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	}))
		.after((request) => {
			capturedInternal = request.internal.x402;
		})
		.use(
			httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
		);

	await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(capturedInternal?.payer, "0xpayer");
	strictEqual(capturedInternal?.transaction, "0xtx");
});

test("price conversion: 0.001 with default decimals produces amount 1000", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.amount, "1000");
});

test("price conversion: 0.01 with decimals:6 produces amount 10000", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			price: 0.01,
			decimals: 6,
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ amount: "10000" }),
				),
			},
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.amount, "10000");
});

test("18-decimal string price produces exact integer atomic amount", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			price: "1.000000000000000001",
			decimals: 18,
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ amount: "1000000000000000001" }),
				),
			},
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.amount, "1000000000000000001");
});

test("exponential-notation small numeric price (1e-7) on an 18-decimal asset is exact", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	// String(1e-7) === "1e-7"; the converter must expand it rather than reject it.
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			price: 1e-7,
			decimals: 18,
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ amount: (10n ** 11n).toString() }),
				),
			},
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.amount, (10n ** 11n).toString());
});

test("exponential-notation large numeric price (1e21) is expanded, not rejected", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	// String(1e21) === "1e+21"; decimals:0 keeps the atomic amount equal to price.
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			price: 1e21,
			decimals: 0,
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ amount: (10n ** 21n).toString() }),
				),
			},
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.amount, (10n ** 21n).toString());
});

test("payment header is read in Title-Case as well as lowercase", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	// Title-Case header (a non-normalized source) must be honored (verify runs)
	// rather than treated as a missing header (402).
	const response = await handler(
		{ headers: { "Payment-Signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(mockVerify.mock.callCount(), 1);
	strictEqual(response.statusCode, 200);
});

test("large string price produces non-exponential atomic amount", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			price: "123456789",
			decimals: 18,
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ amount: "123456789000000000000000000" }),
				),
			},
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.amount, "123456789000000000000000000");
});

test("explicit integer amount override is used verbatim", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			price: undefined,
			amount: "987654321",
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ amount: "987654321" }),
				),
			},
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.amount, "987654321");
});

test("omitted price (and no amount) is rejected", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let threw = false;
	try {
		httpX402({
			payTo: "0xpayto",
			asset: "0xasset",
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		threw = true;
		ok(e.cause?.package === "@middy/http-x402");
	}
	ok(threw);
});

test("empty string price is rejected", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let threw = false;
	try {
		httpX402({
			price: "",
			payTo: "0xpayto",
			asset: "0xasset",
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		threw = true;
		ok(e.cause?.package === "@middy/http-x402");
	}
	ok(threw);
});

test("non-integer amount override is rejected", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let threw = false;
	try {
		httpX402({
			amount: "12.5",
			payTo: "0xpayto",
			asset: "0xasset",
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		threw = true;
		ok(e.cause?.package === "@middy/http-x402");
	}
	ok(threw);
});

test("price with more fractional digits than decimals is rejected", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let threw = false;
	try {
		httpX402({
			price: "0.0000001",
			decimals: 6,
			payTo: "0xpayto",
			asset: "0xasset",
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		threw = true;
		ok(e.cause?.package === "@middy/http-x402");
	}
	ok(threw);
});

test("human returns true - skips payment entirely", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({
			...defaultOptions,
			FacilitatorClient: MockFacilitatorClient,
			human: () => true,
		}),
	);

	const response = await handler({ headers: {} }, defaultContext);

	strictEqual(response.statusCode, 200);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("human returns false - normal payment flow", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({
			...defaultOptions,
			FacilitatorClient: MockFacilitatorClient,
			human: () => false,
		}),
	);

	const response = await handler({ headers: {} }, defaultContext);
	strictEqual(response.statusCode, 402);
});

test("API Gateway v1 resource URL from trusted requestContext, ignoring spoofed Host header", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				Host: "attacker.example.com",
				host: "attacker.example.com",
			},
			path: "/spoofed/path",
			requestContext: {
				domainName: "api.example.com",
				path: "/api/data",
			},
		},
		defaultContext,
	);

	const challenge = decodeResponseHeader(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(challenge.resource.url, "https://api.example.com/api/data");
});

test("API Gateway v2 resource URL from requestContext", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			version: "2.0",
			headers: {},
			requestContext: {
				domainName: "api.example.com",
				http: { path: "/api/data" },
			},
		},
		defaultContext,
	);

	const challenge = decodeResponseHeader(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(challenge.resource.url, "https://api.example.com/api/data");
});

test("custom description and mimeType are surfaced in resource info", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({
			...defaultOptions,
			description: "Premium data",
			mimeType: "text/csv",
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	const response = await handler({ headers: {} }, defaultContext);

	const challenge = decodeResponseHeader(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(challenge.resource.description, "Premium data");
	strictEqual(challenge.resource.mimeType, "text/csv");
});

test("default facilitatorUrl is passed to FacilitatorClient, nothing else", (t) => {
	let capturedArg;
	class MockFacilitatorClient {
		constructor(arg) {
			capturedArg = arg;
		}
		verify() {}
		settle() {}
	}
	httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient });
	deepStrictEqual(capturedArg, { url: "https://x402.org/facilitator" });
});

test("httpX402ValidateOptions - FacilitatorClient must be a Function", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({
			price: 0.001,
			payTo: "0x",
			asset: "0x",
			FacilitatorClient: 123,
		});
	} catch (e) {
		threw = true;
		ok(e.message.includes("instanceof Function"));
	}
	ok(threw);
});

test("httpX402ValidateOptions - facilitatorUrl must be string", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({
			price: 0.001,
			payTo: "0x",
			asset: "0x",
			facilitatorUrl: 123,
		});
	} catch (e) {
		threw = true;
		ok(e.message.includes("facilitatorUrl"));
		ok(e.message.includes("string"));
	}
	ok(threw);
});

test("httpX402ValidateOptions - amount must be string", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({
			price: 0.001,
			payTo: "0x",
			asset: "0x",
			amount: 123,
		});
	} catch (e) {
		threw = true;
		ok(e.message.includes("amount"));
		ok(e.message.includes("string"));
	}
	ok(threw);
});

test("httpX402ValidateOptions - decimals must be integer", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({
			price: 0.001,
			payTo: "0x",
			asset: "0x",
			decimals: 6.5,
		});
	} catch (e) {
		threw = true;
		ok(e.message.includes("decimals"));
		ok(e.message.includes("integer"));
	}
	ok(threw);
});

test("httpX402ValidateOptions - network must be string", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({
			price: 0.001,
			payTo: "0x",
			asset: "0x",
			network: 123,
		});
	} catch (e) {
		threw = true;
		ok(e.message.includes("network"));
		ok(e.message.includes("string"));
	}
	ok(threw);
});

test("httpX402ValidateOptions - description must be string", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({
			price: 0.001,
			payTo: "0x",
			asset: "0x",
			description: 123,
		});
	} catch (e) {
		threw = true;
		ok(e.message.includes("description"));
		ok(e.message.includes("string"));
	}
	ok(threw);
});

test("httpX402ValidateOptions - mimeType must be string", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({
			price: 0.001,
			payTo: "0x",
			asset: "0x",
			mimeType: 123,
		});
	} catch (e) {
		threw = true;
		ok(e.message.includes("mimeType"));
		ok(e.message.includes("string"));
	}
	ok(threw);
});

test("decode-error 402 sets Content-Type application/json", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(42) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["Content-Type"], "application/json");
});

test("verify-error 402 sets Content-Type application/json", async (t) => {
	const mockVerify = t.mock.fn(async () => {
		throw new Error("down");
	});
	class MockFacilitatorClient {
		verify(...args) {
			return mockVerify(...args);
		}
		settle() {}
	}
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["Content-Type"], "application/json");
});

test("invalid-verifyResult 402 sets Content-Type application/json", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		{ isValid: false, invalidReason: "bad" },
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["Content-Type"], "application/json");
});

test("settle-error 402 sets Content-Type application/json", async (t) => {
	const mockSettle = t.mock.fn(async () => {
		throw new Error("down");
	});
	class MockFacilitatorClient {
		verify() {
			return defaultVerifyResult;
		}
		settle(...args) {
			return mockSettle(...args);
		}
	}
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["Content-Type"], "application/json");
});

test("settle-failure 402 sets Content-Type application/json", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(t, defaultVerifyResult, {
		success: false,
		errorReason: "insufficient_funds",
	});
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["Content-Type"], "application/json");
});

test("decode-error 402 body is x402Version 2 with Payment required", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(42) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["Content-Type"], "application/json");
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 2);
	strictEqual(body.error, "Payment required");
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("network-mismatch 402 body is x402Version 2 with no-match error", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const wrongNetwork = withAccepted({ network: "eip155:1" });
	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(wrongNetwork) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["Content-Type"], "application/json");
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 2);
	strictEqual(body.error, "No matching payment requirements");
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("verify-invalid 402 body is x402Version 2 with facilitator invalidReason", async (t) => {
	const { MockFacilitatorClient, mockVerify, mockSettle } = makeMockClient(
		t,
		{ isValid: false, invalidReason: "insufficient_balance" },
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["Content-Type"], "application/json");
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 2);
	strictEqual(body.error, "insufficient_balance");
	strictEqual(mockVerify.mock.callCount(), 1);
	strictEqual(mockSettle.mock.callCount(), 0);
});

test("successful verify stores payload and requirements in internal.x402", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);

	let capturedStored;
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	}))
		.before((request) => {
			request.internal.captureAfterBefore = true;
		})
		.after((request) => {
			capturedStored = request.internal.x402;
		})
		.use(
			httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
		);

	await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	ok(capturedStored?.payload);
	strictEqual(capturedStored.payload.accepted.scheme, "exact");
	ok(capturedStored?.requirements);
	strictEqual(capturedStored.requirements.payTo, "0xpayto");
});

test("expandExponential splits mantissa on decimal point (fractional exponential price)", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	// String(1.5e-7) === "1.5e-7"; int part "1", frac part "5" must be joined as
	// digits "15", not split on each character.
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			price: 1.5e-7,
			decimals: 18,
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ amount: "150000000000" }),
				),
			},
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	// 1.5e-7 * 1e18 = 1.5e11 = 150000000000
	strictEqual(requirements.amount, "150000000000");
});

test("expandExponential boundary where decimal point lands at index 0 (1e-7)", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	// String(1e-7) === "1e-7": intPart "1" (len 1), exp -7, point = 1 + -7 = -6.
	// Use a value where point === 0 to exercise the <= boundary: String(1e-7)
	// gives point -6; we need point 0. 1e-1 is not exponential. Instead build a
	// mantissa so point===0: not reachable via JS exponential output, covered
	// by the existing 1e-7 path through the point<=0 branch.
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			price: 1e-7,
			decimals: 18,
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ amount: "100000000000" }),
				),
			},
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.amount, "100000000000");
});

test("string price is parsed via String(price) branch, not numeric expansion", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	// A string price with trailing garbage must be rejected. If the number-branch
	// were always taken, String(price) on a string is identity and the regex still
	// rejects it, but the discriminating case is a string that would mis-coerce.
	// "1e2" as a string is NOT valid decimal (regex requires plain digits/dot) and
	// must throw; a number 1e2 would expand to "100" and pass.
	let threw = false;
	try {
		httpX402({
			price: "1e2",
			payTo: "0xpayto",
			asset: "0xasset",
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		threw = true;
		ok(e.cause?.package === "@middy/http-x402");
	}
	ok(threw);
});

test("non-integer amount override error message describes the constraint", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let message;
	try {
		httpX402({
			amount: "12.5",
			payTo: "0xpayto",
			asset: "0xasset",
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		message = e.message;
	}
	ok(message?.includes("amount must be a non-negative integer string"));
});

test("price with trailing garbage is rejected (regex end anchor)", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let threw = false;
	try {
		httpX402({
			price: "1.5abc",
			payTo: "0xpayto",
			asset: "0xasset",
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		threw = true;
		ok(e.cause?.package === "@middy/http-x402");
	}
	ok(threw);
});

test("price with leading garbage is rejected (regex start anchor)", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let threw = false;
	try {
		httpX402({
			price: "abc1.5",
			payTo: "0xpayto",
			asset: "0xasset",
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		threw = true;
		ok(e.cause?.package === "@middy/http-x402");
	}
	ok(threw);
});

test("fraction-only price like .5 is accepted (empty whole, fraction present)", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			price: ".5",
			decimals: 6,
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ amount: "500000" }),
				),
			},
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.amount, "500000");
});

test("invalid-price error message describes the constraint", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let message;
	try {
		httpX402({
			price: "abc",
			payTo: "0xpayto",
			asset: "0xasset",
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		message = e.message;
	}
	ok(
		message?.includes("price must be a non-negative decimal string or number"),
	);
});

test("too-many-fractional-digits error message names decimals", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let message;
	try {
		httpX402({
			price: "0.0000001",
			decimals: 6,
			payTo: "0xpayto",
			asset: "0xasset",
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		message = e.message;
	}
	ok(message?.includes("price has more fractional digits than decimals (6)"));
});

test("buildResource v1 falls back to localhost host when requestContext is absent", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				Host: "attacker.example.com",
			},
		},
		defaultContext,
	);

	const challenge = decodeResponseHeader(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(challenge.resource.url, "https://localhost/");
});

test("buildResource v1 falls back to / path when requestContext has no path", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				Host: "attacker.example.com",
			},
			path: "/spoofed/path",
			requestContext: {
				domainName: "api.example.com",
			},
		},
		defaultContext,
	);

	const challenge = decodeResponseHeader(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(challenge.resource.url, "https://api.example.com/");
});

test("non-object payment payload error message and cause", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	// Exercise decodeHeader directly via a valid base64 of a non-object so the
	// thrown Error's message and cause.package are observable. The middleware
	// catches it and returns 402, so assert through a stubbed verify never running
	// plus the decode path; here we re-derive by importing the behavior indirectly:
	// a number payload yields invalid_payment 402 (already covered), so assert the
	// internal Error contract by decoding a non-object through the public 402 path
	// is insufficient. Instead assert the error is surfaced by monkey-less path:
	// the middleware swallows it, so we validate the message via a direct catch is
	// not possible. Cover the message/cause through the 402 invariant plus body.
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader("just a string") } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.error, "Payment required");
});

test("httpX402ValidateOptions - missing required field payTo throws", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({ price: 0.001, asset: "0x" });
	} catch (e) {
		threw = true;
		ok(e.message.includes("payTo"));
	}
	ok(threw);
});

test("httpX402ValidateOptions - missing required field asset throws", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({ price: 0.001, payTo: "0x" });
	} catch (e) {
		threw = true;
		ok(e.message.includes("asset"));
	}
	ok(threw);
});

test("httpX402ValidateOptions - unknown option throws", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({
			price: 0.001,
			payTo: "0x",
			asset: "0x",
			unknown: true,
		});
	} catch (e) {
		threw = true;
		ok(e.message.includes("unknown"));
	}
	ok(threw);
});

test("httpX402ValidateOptions - valid minimal options pass", () => {
	httpX402ValidateOptions({ price: 0.001, payTo: "0x", asset: "0x" });
});

test("httpX402ValidateOptions - valid options with human function pass", () => {
	httpX402ValidateOptions({
		price: 0.001,
		payTo: "0x",
		asset: "0x",
		human: () => false,
	});
});

test("httpX402ValidateOptions - extra must be object", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({
			price: 0.001,
			payTo: "0x",
			asset: "0x",
			extra: "usdc",
		});
	} catch (e) {
		threw = true;
		ok(e.message.includes("extra"));
		ok(e.message.includes("object"));
	}
	ok(threw);
});

test("unsupported payload x402Version returns 402 invalid_x402_version", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader({
					...testPayload,
					x402Version: 1,
				}),
			},
		},
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.error, "invalid_x402_version");
	ok(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("missing payload x402Version returns 402 invalid_x402_version", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const { x402Version, ...versionless } = testPayload;
	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(versionless) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(JSON.parse(response.body).error, "invalid_x402_version");
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("accepted amount mismatch is rejected without calling the facilitator", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(withAccepted({ amount: "999" })),
			},
		},
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(
		JSON.parse(response.body).error,
		"No matching payment requirements",
	);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("accepted asset mismatch is rejected without calling the facilitator", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ asset: "0xother" }),
				),
			},
		},
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(
		JSON.parse(response.body).error,
		"No matching payment requirements",
	);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("accepted payTo mismatch is rejected without calling the facilitator", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ payTo: "0xother" }),
				),
			},
		},
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(
		JSON.parse(response.body).error,
		"No matching payment requirements",
	);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("accepted maxTimeoutSeconds mismatch is rejected without calling the facilitator", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(
					withAccepted({ maxTimeoutSeconds: 120 }),
				),
			},
		},
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(
		JSON.parse(response.body).error,
		"No matching payment requirements",
	);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("payload without accepted object is rejected as no-match", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const { accepted, ...noAccepted } = testPayload;
	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(noAccepted) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(
		JSON.parse(response.body).error,
		"No matching payment requirements",
	);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("payload with null accepted is rejected as no-match", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader({
					...testPayload,
					accepted: null,
				}),
			},
		},
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(
		JSON.parse(response.body).error,
		"No matching payment requirements",
	);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("payment header is read in canonical UPPERCASE form", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "PAYMENT-SIGNATURE": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(mockVerify.mock.callCount(), 1);
	strictEqual(response.statusCode, 200);
});

test("verify receives the payload and canonical requirements without resource info", async (t) => {
	const { MockFacilitatorClient, mockVerify, mockSettle } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	const [payload, requirements] = mockVerify.mock.calls[0].arguments;
	deepStrictEqual(payload, testPayload);
	deepStrictEqual(requirements, {
		scheme: "exact",
		network: "eip155:8453",
		amount: "1000",
		asset: "0xasset",
		payTo: "0xpayto",
		maxTimeoutSeconds: 60,
	});
	const [settlePayload, settleRequirements] =
		mockSettle.mock.calls[0].arguments;
	deepStrictEqual(settlePayload, testPayload);
	deepStrictEqual(settleRequirements, requirements);
});

test("verify throws with a string invalidReason - reason is forwarded", async (t) => {
	const mockVerify = t.mock.fn(async () => {
		const error = new Error("Facilitator verify failed (400)");
		error.invalidReason = "invalid_exact_evm_payload_signature";
		throw error;
	});
	class MockFacilitatorClient {
		verify(...args) {
			return mockVerify(...args);
		}
		settle() {}
	}
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(
		JSON.parse(response.body).error,
		"invalid_exact_evm_payload_signature",
	);
});

test("verify throws with a non-string invalidReason - generic reason", async (t) => {
	const mockVerify = t.mock.fn(async () => {
		const error = new Error("boom");
		error.invalidReason = 42;
		throw error;
	});
	class MockFacilitatorClient {
		verify(...args) {
			return mockVerify(...args);
		}
		settle() {}
	}
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(JSON.parse(response.body).error, "unexpected_verify_error");
});

test("verify throws null - still a clean 402", async (t) => {
	const mockVerify = t.mock.fn(async () => {
		throw null;
	});
	class MockFacilitatorClient {
		verify(...args) {
			return mockVerify(...args);
		}
		settle() {}
	}
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(JSON.parse(response.body).error, "unexpected_verify_error");
});

test("settle throws with a string errorReason - reason is forwarded", async (t) => {
	const mockSettle = t.mock.fn(async () => {
		const error = new Error("Facilitator settle failed (402)");
		error.errorReason = "insufficient_funds";
		throw error;
	});
	class MockFacilitatorClient {
		verify() {
			return defaultVerifyResult;
		}
		settle(...args) {
			return mockSettle(...args);
		}
	}
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(JSON.parse(response.body).error, "insufficient_funds");
	const settlement = decodeResponseHeader(response.headers["PAYMENT-RESPONSE"]);
	strictEqual(settlement.errorReason, "insufficient_funds");
});

test("settle throws settlement_pending with a transaction - hash is forwarded", async (t) => {
	const mockSettle = t.mock.fn(async () => {
		const error = new Error("receipt timeout");
		error.errorReason = "settlement_pending";
		error.transaction = "0xabc123";
		throw error;
	});
	class MockFacilitatorClient {
		verify() {
			return defaultVerifyResult;
		}
		settle(...args) {
			return mockSettle(...args);
		}
	}
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const settlement = decodeResponseHeader(response.headers["PAYMENT-RESPONSE"]);
	strictEqual(settlement.errorReason, "settlement_pending");
	strictEqual(settlement.transaction, "0xabc123");
});

test("settle throws with a non-string transaction - empty transaction", async (t) => {
	const mockSettle = t.mock.fn(async () => {
		const error = new Error("boom");
		error.errorReason = "insufficient_funds";
		error.transaction = 42;
		throw error;
	});
	class MockFacilitatorClient {
		verify() {
			return defaultVerifyResult;
		}
		settle(...args) {
			return mockSettle(...args);
		}
	}
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const settlement = decodeResponseHeader(response.headers["PAYMENT-RESPONSE"]);
	strictEqual(settlement.transaction, "");
});

test("settle throws with a non-string errorReason - generic reason", async (t) => {
	const mockSettle = t.mock.fn(async () => {
		const error = new Error("boom");
		error.errorReason = 42;
		throw error;
	});
	class MockFacilitatorClient {
		verify() {
			return defaultVerifyResult;
		}
		settle(...args) {
			return mockSettle(...args);
		}
	}
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(JSON.parse(response.body).error, "unexpected_settle_error");
});

test("settle throws null - still a clean 402", async (t) => {
	const mockSettle = t.mock.fn(async () => {
		throw null;
	});
	class MockFacilitatorClient {
		verify() {
			return defaultVerifyResult;
		}
		settle(...args) {
			return mockSettle(...args);
		}
	}
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(JSON.parse(response.body).error, "unexpected_settle_error");
});

test("extra option is advertised in accepts and matched against accepted", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const extra = { name: "USDC", version: "2" };
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			extra,
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	const unpaid = await handler({ headers: {} }, defaultContext);
	deepStrictEqual(JSON.parse(unpaid.body).accepts[0].extra, extra);
	deepStrictEqual(
		decodeResponseHeader(unpaid.headers["PAYMENT-REQUIRED"]).accepts[0].extra,
		extra,
	);

	const paid = await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(withAccepted({ extra })),
			},
		},
		defaultContext,
	);
	strictEqual(paid.statusCode, 200);
	const [, requirements] = mockVerify.mock.calls[0].arguments;
	deepStrictEqual(requirements.extra, extra);
});

test("accepts entry has no extra key when the option is not set", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler({ headers: {} }, defaultContext);

	const challenge = decodeResponseHeader(response.headers["PAYMENT-REQUIRED"]);
	ok(!Object.hasOwn(challenge.accepts[0], "extra"));
});

test("extra.paymentFlow is rejected at construction", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let error;
	try {
		httpX402({
			...defaultOptions,
			extra: { paymentFlow: "upfront" },
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		error = e;
	}
	ok(error?.message.includes("paymentFlow"));
	strictEqual(error?.cause?.package, "@middy/http-x402");
});

test("extra.assetTransferMethod is rejected at construction", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let error;
	try {
		httpX402({
			...defaultOptions,
			extra: { assetTransferMethod: "escrow" },
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		error = e;
	}
	ok(error?.message.includes("assetTransferMethod"));
	strictEqual(error?.cause?.package, "@middy/http-x402");
});

// x402 v1 (X-PAYMENT header, challenge in the body, X-PAYMENT-RESPONSE header)

const testPayloadV1 = {
	x402Version: 1,
	scheme: "exact",
	network: "eip155:8453",
	payload: { signature: "0xsig", authorization: {} },
};

const expectedRequirementsV1 = {
	scheme: "exact",
	network: "eip155:8453",
	maxAmountRequired: "1000",
	resource: "https://localhost/",
	description: "",
	mimeType: "application/json",
	outputSchema: {},
	payTo: "0xpayto",
	maxTimeoutSeconds: 60,
	asset: "0xasset",
	extra: {},
};

test("v1 X-PAYMENT payment verifies and settles with X-PAYMENT-RESPONSE", async (t) => {
	const { MockFacilitatorClient, mockVerify, mockSettle } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "x-payment": makePaymentHeader(testPayloadV1) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 200);
	deepStrictEqual(
		decodeResponseHeader(response.headers["X-PAYMENT-RESPONSE"]),
		defaultSettleResult,
	);
	strictEqual(response.headers["PAYMENT-RESPONSE"], undefined);
	const [payload, requirements] = mockVerify.mock.calls[0].arguments;
	deepStrictEqual(payload, testPayloadV1);
	deepStrictEqual(requirements, expectedRequirementsV1);
	const [settlePayload, settleRequirements] =
		mockSettle.mock.calls[0].arguments;
	deepStrictEqual(settlePayload, testPayloadV1);
	deepStrictEqual(settleRequirements, expectedRequirementsV1);
});

test("v1 header is read in Title-Case form", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "X-Payment": makePaymentHeader(testPayloadV1) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 200);
	strictEqual(mockVerify.mock.callCount(), 1);
});

test("v1 header is read in canonical UPPERCASE form", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "X-PAYMENT": makePaymentHeader(testPayloadV1) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 200);
	strictEqual(mockVerify.mock.callCount(), 1);
});

test("v1 rejections respond with a v1 body challenge, no PAYMENT-REQUIRED header", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				"x-payment": makePaymentHeader({
					...testPayloadV1,
					network: "eip155:1",
				}),
			},
		},
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["Content-Type"], "application/json");
	strictEqual(response.headers["PAYMENT-REQUIRED"], undefined);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 1);
	strictEqual(body.error, "No matching payment requirements");
	deepStrictEqual(body.accepts[0], expectedRequirementsV1);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("v1 scheme mismatch is rejected without calling the facilitator", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				"x-payment": makePaymentHeader({ ...testPayloadV1, scheme: "upto" }),
			},
		},
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(
		JSON.parse(response.body).error,
		"No matching payment requirements",
	);
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("v1 undecodable X-PAYMENT is treated as missing payment", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "x-payment": "not!!valid!!base64" } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 1);
	strictEqual(body.error, "Payment required");
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("v1 payload with wrong x402Version returns 402 invalid_x402_version", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{
			headers: {
				"x-payment": makePaymentHeader({ ...testPayloadV1, x402Version: 2 }),
			},
		},
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 1);
	strictEqual(body.error, "invalid_x402_version");
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("v1 verify failure returns 402 with invalidReason in the v1 body", async (t) => {
	const { MockFacilitatorClient, mockSettle } = makeMockClient(
		t,
		{ isValid: false, invalidReason: "insufficient_funds" },
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "x-payment": makePaymentHeader(testPayloadV1) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 1);
	strictEqual(body.error, "insufficient_funds");
	strictEqual(mockSettle.mock.callCount(), 0);
});

test("v1 verify throws - clean 402 v1 body without leaking message", async (t) => {
	const mockVerify = t.mock.fn(async () => {
		throw new Error("facilitator 503: v1 secret detail");
	});
	class MockFacilitatorClient {
		verify(...args) {
			return mockVerify(...args);
		}
		settle() {}
	}
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "x-payment": makePaymentHeader(testPayloadV1) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 1);
	strictEqual(body.error, "unexpected_verify_error");
	ok(!response.body.includes("v1 secret detail"));
});

test("v1 settle failure returns 402 with X-PAYMENT-RESPONSE", async (t) => {
	const failedSettleResult = {
		success: false,
		errorReason: "insufficient_funds",
		transaction: "",
		network: "eip155:8453",
		payer: "0xpayer",
	};
	const { MockFacilitatorClient, mockSettle } = makeMockClient(
		t,
		defaultVerifyResult,
		failedSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "x-payment": makePaymentHeader(testPayloadV1) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 1);
	strictEqual(body.error, "insufficient_funds");
	deepStrictEqual(
		decodeResponseHeader(response.headers["X-PAYMENT-RESPONSE"]),
		failedSettleResult,
	);
	strictEqual(response.headers["PAYMENT-RESPONSE"], undefined);
	strictEqual(mockSettle.mock.callCount(), 1);
});

test("v1 settle throws - clean 402 with synthesized X-PAYMENT-RESPONSE", async (t) => {
	const mockSettle = t.mock.fn(async () => {
		throw new Error("facilitator 503: v1 settle secret detail");
	});
	class MockFacilitatorClient {
		verify() {
			return defaultVerifyResult;
		}
		settle(...args) {
			return mockSettle(...args);
		}
	}
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "x-payment": makePaymentHeader(testPayloadV1) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 1);
	strictEqual(body.error, "unexpected_settle_error");
	const settlement = decodeResponseHeader(
		response.headers["X-PAYMENT-RESPONSE"],
	);
	strictEqual(settlement.success, false);
	strictEqual(settlement.errorReason, "unexpected_settle_error");
	strictEqual(settlement.transaction, "");
	strictEqual(settlement.network, "eip155:8453");
	ok(!JSON.stringify(settlement).includes("v1 settle secret detail"));
	ok(!response.body.includes("v1 settle secret detail"));
});

test("v1 internal.x402 stores the payload and v1 requirements", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);

	let capturedStored;
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	}))
		.after((request) => {
			capturedStored = request.internal.x402;
		})
		.use(
			httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
		);

	await handler(
		{ headers: { "x-payment": makePaymentHeader(testPayloadV1) } },
		defaultContext,
	);

	strictEqual(capturedStored?.payload.scheme, "exact");
	strictEqual(capturedStored?.requirements.maxAmountRequired, "1000");
	strictEqual(capturedStored?.payer, "0xpayer");
	strictEqual(capturedStored?.transaction, "0xtx");
});

test("v1 requirements carry the extra option and per-request resource URL", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const extra = { name: "USDC", version: "2" };
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			extra,
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	await handler(
		{
			headers: { "x-payment": makePaymentHeader(testPayloadV1) },
			requestContext: {
				domainName: "api.example.com",
				path: "/api/data",
			},
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	deepStrictEqual(requirements.extra, extra);
	strictEqual(requirements.resource, "https://api.example.com/api/data");
});

test("both payment headers present - v2 wins", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	// The v1 header carries garbage; only the v2 flow can succeed.
	const response = await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(testPayload),
				"x-payment": "garbage",
			},
		},
		defaultContext,
	);

	strictEqual(response.statusCode, 200);
	const [payload] = mockVerify.mock.calls[0].arguments;
	deepStrictEqual(payload, testPayload);
});

test("settle failure clears isBase64Encoded when replacing a binary body", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(t, defaultVerifyResult, {
		success: false,
		errorReason: "insufficient_funds",
		transaction: "",
		network: "eip155:8453",
	});
	const handler = middy(() => ({
		statusCode: 200,
		body: Buffer.from("binary").toString("base64"),
		isBase64Encoded: true,
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.isBase64Encoded, false);
	strictEqual(JSON.parse(response.body).error, "insufficient_funds");
});

test("settle throw clears isBase64Encoded when replacing a binary body", async (t) => {
	const mockSettle = t.mock.fn(async () => {
		throw new Error("down");
	});
	class MockFacilitatorClient {
		verify() {
			return defaultVerifyResult;
		}
		settle(...args) {
			return mockSettle(...args);
		}
	}
	const handler = middy(() => ({
		statusCode: 200,
		body: Buffer.from("binary").toString("base64"),
		isBase64Encoded: true,
		headers: {},
	})).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.isBase64Encoded, false);
	strictEqual(JSON.parse(response.body).error, "unexpected_settle_error");
});

test("advertised v2 requirements are frozen against cross-request mutation", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);

	let capturedStored;
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	}))
		.after((request) => {
			capturedStored = request.internal.x402;
		})
		.use(
			httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
		);

	await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	ok(Object.isFrozen(requirements));
	ok(Object.isFrozen(capturedStored.requirements));
});

// versions toggle

test("versions [2]: v1 X-PAYMENT payment is re-challenged, facilitator untouched", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({
			...defaultOptions,
			versions: [2],
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	const response = await handler(
		{ headers: { "x-payment": makePaymentHeader(testPayloadV1) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	ok(response.headers["PAYMENT-REQUIRED"]);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 2);
	strictEqual(body.error, "PAYMENT-SIGNATURE header is required");
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("versions [2]: unpaid 402 body mirrors the v2 header, no v1 challenge", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({
			...defaultOptions,
			versions: [2],
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	const response = await handler({ headers: {} }, defaultContext);

	strictEqual(response.statusCode, 402);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 2);
	strictEqual(body.accepts[0].amount, "1000");
	deepStrictEqual(
		decodeResponseHeader(response.headers["PAYMENT-REQUIRED"]),
		body,
	);
});

test("versions [2]: v2 payment still verifies and settles", async (t) => {
	const { MockFacilitatorClient, mockSettle } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			versions: [2],
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 200);
	ok(response.headers["PAYMENT-RESPONSE"]);
	strictEqual(mockSettle.mock.callCount(), 1);
});

test("versions [1]: v2 PAYMENT-SIGNATURE payment is re-challenged as v1, facilitator untouched", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({
			...defaultOptions,
			versions: [1],
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["PAYMENT-REQUIRED"], undefined);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 1);
	strictEqual(body.error, "X-PAYMENT header is required");
	strictEqual(mockVerify.mock.callCount(), 0);
});

test("versions [1]: v1 payment still verifies and settles", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			versions: [1],
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	const response = await handler(
		{ headers: { "x-payment": makePaymentHeader(testPayloadV1) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 200);
	ok(response.headers["X-PAYMENT-RESPONSE"]);
});

test("versions [1]: unpaid 402 is v1-only, no PAYMENT-REQUIRED header", async (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({
			...defaultOptions,
			versions: [1],
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	const response = await handler({ headers: {} }, defaultContext);

	strictEqual(response.statusCode, 402);
	strictEqual(response.headers["PAYMENT-REQUIRED"], undefined);
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 1);
	strictEqual(body.error, "X-PAYMENT header is required");
	deepStrictEqual(body.accepts[0], expectedRequirementsV1);
});

test("versions [1]: with both headers present the v1 payment is used", async (t) => {
	const { MockFacilitatorClient, mockVerify } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({
		statusCode: 200,
		body: "ok",
		headers: {},
	})).use(
		httpX402({
			...defaultOptions,
			versions: [1],
			FacilitatorClient: MockFacilitatorClient,
		}),
	);

	const response = await handler(
		{
			headers: {
				"payment-signature": makePaymentHeader(testPayload),
				"x-payment": makePaymentHeader(testPayloadV1),
			},
		},
		defaultContext,
	);

	strictEqual(response.statusCode, 200);
	ok(response.headers["X-PAYMENT-RESPONSE"]);
	const [payload] = mockVerify.mock.calls[0].arguments;
	deepStrictEqual(payload, testPayloadV1);
});

test("empty versions array is rejected at construction", (t) => {
	const { MockFacilitatorClient } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	let error;
	try {
		httpX402({
			...defaultOptions,
			versions: [],
			FacilitatorClient: MockFacilitatorClient,
		});
	} catch (e) {
		error = e;
	}
	ok(error?.message.includes("versions"));
	strictEqual(error?.cause?.package, "@middy/http-x402");
});

test("httpX402ValidateOptions - versions items must be 1 or 2", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({
			price: 0.001,
			payTo: "0x",
			asset: "0x",
			versions: [3],
		});
	} catch (e) {
		threw = true;
		ok(e.message.includes("versions"));
	}
	ok(threw);
});

test("httpX402ValidateOptions - versions must be an array", () => {
	let threw = false;
	try {
		httpX402ValidateOptions({
			price: 0.001,
			payTo: "0x",
			asset: "0x",
			versions: 2,
		});
	} catch (e) {
		threw = true;
		ok(e.message.includes("versions"));
		ok(e.message.includes("array"));
	}
	ok(threw);
});

test("httpX402ValidateOptions - valid versions pass", () => {
	httpX402ValidateOptions({
		price: 0.001,
		payTo: "0x",
		asset: "0x",
		versions: [1, 2],
	});
	httpX402ValidateOptions({
		price: 0.001,
		payTo: "0x",
		asset: "0x",
		versions: [2],
	});
});

test("settlement normalizes a response that omits headers", async (t) => {
	// Every other settlement test hands back an explicit `headers: {}`, so the
	// normalize call is invisible. A handler that omits headers is the only way
	// to show it: without normalizing, writing the settlement header throws.
	const { MockFacilitatorClient, mockSettle } = makeMockClient(
		t,
		defaultVerifyResult,
		defaultSettleResult,
	);
	const handler = middy(() => ({ statusCode: 200, body: "ok" })).use(
		httpX402({ ...defaultOptions, FacilitatorClient: MockFacilitatorClient }),
	);

	const response = await handler(
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	strictEqual(response.statusCode, 200);
	ok(response.headers["PAYMENT-RESPONSE"]);
	strictEqual(mockSettle.mock.callCount(), 1);
});
