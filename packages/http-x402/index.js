// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { normalizeHttpResponse, validateOptions } from "@middy/util";
import { HTTPFacilitatorClient } from "@x402/core/http";

const name = "http-x402";
const pkg = `@middy/${name}`;

const defaults = {
	FacilitatorClient: HTTPFacilitatorClient,
	facilitatorUrl: "https://x402.org/facilitator",
	price: undefined,
	decimals: 6,
	network: "eip155:8453",
	payTo: undefined,
	asset: undefined,
	description: "",
	mimeType: "application/json",
	human: undefined,
};

const optionSchema = {
	type: "object",
	properties: {
		FacilitatorClient: { instanceof: "Function" },
		facilitatorUrl: { type: "string" },
		price: { type: "number", exclusiveMinimum: 0 },
		decimals: { type: "integer" },
		network: { type: "string" },
		payTo: { type: "string" },
		asset: { type: "string" },
		description: { type: "string" },
		mimeType: { type: "string" },
		human: (v) => typeof v === "function",
	},
	required: ["price", "payTo", "asset"],
	additionalProperties: false,
};

export const httpX402ValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const httpX402Middleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const {
		FacilitatorClient,
		facilitatorUrl,
		price,
		decimals,
		network,
		payTo,
		asset,
		description,
		mimeType,
		human,
	} = options;

	const amount = String(Math.round(price * 10 ** decimals));
	const requirements = {
		scheme: "exact",
		network,
		amount,
		asset,
		payTo,
		maxTimeoutSeconds: 60,
		description,
		mimeType,
	};
	const facilitator = new FacilitatorClient({ url: facilitatorUrl });

	const httpX402MiddlewareBefore = async (request) => {
		if (human?.(request)) return;

		const headers = request.event.headers ?? {};
		const paymentHeader = headers["payment-signature"];

		const resource = buildResource(request.event);
		const fullRequirements = { ...requirements, resource };

		if (!paymentHeader) {
			normalizeHttpResponse(request);
			const paymentRequired = {
				x402Version: 2,
				error: "Payment required",
				accepts: [fullRequirements],
			};
			request.response.statusCode = 402;
			request.response.headers["Content-Type"] = "application/json";
			request.response.headers["PAYMENT-REQUIRED"] =
				encodeHeader(paymentRequired);
			request.response.body = JSON.stringify(paymentRequired);
			return request.response;
		}

		let payload;
		try {
			payload = decodeHeader(paymentHeader);
		} catch {
			normalizeHttpResponse(request);
			request.response.statusCode = 402;
			request.response.headers["Content-Type"] = "application/json";
			request.response.body = JSON.stringify({
				x402Version: 2,
				error: "invalid_payment",
			});
			return request.response;
		}

		const verifyResult = await facilitator.verify(payload, fullRequirements);
		if (!verifyResult.isValid) {
			normalizeHttpResponse(request);
			request.response.statusCode = 402;
			request.response.headers["Content-Type"] = "application/json";
			request.response.body = JSON.stringify({
				x402Version: 2,
				error: verifyResult.invalidReason,
			});
			return request.response;
		}

		request.internal.x402 = { payload, requirements: fullRequirements };
	};

	const httpX402MiddlewareAfter = async (request) => {
		const stored = request.internal.x402;
		if (!stored) return;

		normalizeHttpResponse(request);
		if (request.response.statusCode >= 400) return;

		const { payload, requirements: fullRequirements } = stored;
		const settleResult = await facilitator.settle(payload, fullRequirements);

		if (!settleResult.success) {
			request.response.statusCode = 402;
			request.response.headers["Content-Type"] = "application/json";
			request.response.body = JSON.stringify({
				x402Version: 2,
				error: settleResult.errorReason,
			});
			return;
		}

		request.internal.x402 = {
			...stored,
			payer: settleResult.payer,
			transaction: settleResult.transaction,
			network: settleResult.network,
		};
		request.response.headers["PAYMENT-RESPONSE"] = encodeHeader(settleResult);
	};

	return {
		before: httpX402MiddlewareBefore,
		after: httpX402MiddlewareAfter,
	};
};

const buildResource = (event) => {
	if (event.version === "2.0") {
		return `https://${event.requestContext.domainName}${event.requestContext.http.path}`;
	}
	const host = event.headers?.Host ?? event.headers?.host ?? "localhost";
	return `https://${host}${event.path ?? "/"}`;
};

const encodeHeader = (obj) =>
	Buffer.from(JSON.stringify(obj)).toString("base64");

const decodeHeader = (header) =>
	JSON.parse(Buffer.from(header, "base64").toString());

export default httpX402Middleware;
