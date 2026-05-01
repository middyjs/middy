import { ok, strictEqual } from "node:assert/strict";
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

const testPayload = {
	x402Version: 2,
	scheme: "exact",
	network: "eip155:8453",
	payload: { signature: "0xsig", authorization: {} },
};

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

test("no payment-signature header returns 402", async (t) => {
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
	ok(response.headers["PAYMENT-REQUIRED"]);
	strictEqual(response.headers["Content-Type"], "application/json");
	const body = JSON.parse(response.body);
	strictEqual(body.x402Version, 2);
	strictEqual(body.error, "Payment required");
	ok(Array.isArray(body.accepts));
	strictEqual(body.accepts[0].scheme, "exact");
	strictEqual(body.accepts[0].amount, "1000");
	strictEqual(body.accepts[0].network, "eip155:8453");
	strictEqual(body.accepts[0].payTo, "0xpayto");
	strictEqual(body.accepts[0].asset, "0xasset");
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
	strictEqual(body.error, "invalid_payment");
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
	strictEqual(mockVerify.mock.callCount(), 1);
	strictEqual(mockSettle.mock.callCount(), 0);
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
	const { MockFacilitatorClient, mockSettle } = makeMockClient(
		t,
		defaultVerifyResult,
		{ success: false, errorReason: "insufficient_funds" },
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
		{ headers: { "payment-signature": makePaymentHeader(testPayload) } },
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.amount, "10000");
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

test("API Gateway v1 resource URL from Host header", async (t) => {
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
		{
			headers: {
				Host: "api.example.com",
				"payment-signature": makePaymentHeader(testPayload),
			},
			path: "/api/data",
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.resource, "https://api.example.com/api/data");
});

test("API Gateway v2 resource URL from requestContext", async (t) => {
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
		{
			version: "2.0",
			headers: { "payment-signature": makePaymentHeader(testPayload) },
			requestContext: {
				domainName: "api.example.com",
				http: { path: "/api/data" },
			},
		},
		defaultContext,
	);

	const [, requirements] = mockVerify.mock.calls[0].arguments;
	strictEqual(requirements.resource, "https://api.example.com/api/data");
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
