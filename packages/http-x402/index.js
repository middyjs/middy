// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { normalizeHttpResponse, validateOptions } from "@middy/util";
import { HTTPFacilitatorClient } from "@x402/core/http";

const name = "http-x402";
const pkg = `@middy/${name}`;

const defaults = {
	FacilitatorClient: HTTPFacilitatorClient,
	facilitatorUrl: "https://x402.org/facilitator",
	// TODO remove in v8: drop 1 from the default versions so v1 acceptance
	// becomes opt-in (smaller attack surface, no legacy facilitator path).
	versions: [1, 2],
	price: undefined,
	amount: undefined,
	decimals: 6,
	network: "eip155:8453",
	payTo: undefined,
	asset: undefined,
	description: "",
	mimeType: "application/json",
	extra: undefined,
	human: undefined,
};

const optionSchema = {
	type: "object",
	properties: {
		FacilitatorClient: { instanceof: "Function" },
		facilitatorUrl: { type: "string" },
		versions: { type: "array", items: { enum: [1, 2] } },
		price: {
			oneOf: [{ type: "number", exclusiveMinimum: 0 }, { type: "string" }],
		},
		amount: { type: "string" },
		decimals: { type: "integer" },
		network: { type: "string" },
		payTo: { type: "string" },
		asset: { type: "string" },
		description: { type: "string" },
		mimeType: { type: "string" },
		extra: { type: "object" },
		human: { instanceof: "Function" },
	},
	required: ["payTo", "asset"],
	additionalProperties: false,
};

export const httpX402ValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const httpX402Middleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const {
		FacilitatorClient,
		facilitatorUrl,
		versions,
		price,
		amount: amountOverride,
		decimals,
		network,
		payTo,
		asset,
		description,
		mimeType,
		extra,
		human,
	} = options;

	const v1Enabled = versions.includes(1);
	const v2Enabled = versions.includes(2);
	if (!v1Enabled && !v2Enabled) {
		throw new Error(`${pkg} versions must enable protocol version 1 or 2`, {
			cause: { package: pkg },
		});
	}

	// `extra.paymentFlow` / `extra.assetTransferMethod` select x402 payment
	// flows (upfront, escrow) this middleware does not implement; it only runs
	// the default authorization flow (verify before the handler, settle after).
	if (
		extra?.paymentFlow !== undefined ||
		extra?.assetTransferMethod !== undefined
	) {
		throw new Error(
			`${pkg} extra.paymentFlow and extra.assetTransferMethod are not supported`,
			{ cause: { package: pkg } },
		);
	}

	const amount = toAtomicAmount(price, decimals, amountOverride);
	// PaymentRequirements (x402 v2): advertised as an `accepts` entry in
	// PAYMENT-REQUIRED responses and passed verbatim to the facilitator.
	// Frozen because the one object is shared by every request of a warm
	// container (challenges, facilitator calls, request.internal.x402); a
	// downstream mutation would silently poison all later requests.
	const requirements = Object.freeze({
		scheme: "exact",
		network,
		amount,
		asset,
		payTo,
		maxTimeoutSeconds: 60,
		...(extra !== undefined && { extra }),
	});
	const facilitator = new FacilitatorClient({ url: facilitatorUrl });

	// x402 v2 clients echo the accepts entry they chose as `accepted`; a payment
	// signed for different terms must be rejected up front.
	// ponytail: `extra` is not compared here; the facilitator re-verifies the
	// signature against our canonical requirements (including extra) anyway.
	const matchesAccepted = (accepted) =>
		typeof accepted === "object" &&
		accepted !== null &&
		accepted.scheme === requirements.scheme &&
		accepted.network === requirements.network &&
		accepted.amount === requirements.amount &&
		accepted.asset === requirements.asset &&
		accepted.payTo === requirements.payTo &&
		accepted.maxTimeoutSeconds === requirements.maxTimeoutSeconds;

	const buildPaymentRequired = (event, error) => ({
		x402Version: 2,
		error,
		resource: {
			url: buildResource(event),
			description,
			mimeType,
		},
		accepts: [requirements],
	});

	// Every v2 pre-handler rejection is a 402 carrying the PaymentRequired
	// object in the PAYMENT-REQUIRED header (and mirrored in the body) so
	// header-only clients can read the error and retry against fresh
	// requirements.
	const respondPaymentRequired = (request, error) => {
		normalizeHttpResponse(request);
		const paymentRequired = buildPaymentRequired(request.event, error);
		request.response.statusCode = 402;
		request.response.headers["Content-Type"] = "application/json";
		request.response.headers["PAYMENT-REQUIRED"] =
			encodeHeader(paymentRequired);
		request.response.body = JSON.stringify(paymentRequired);
		return request.response;
	};

	// x402 v1 PaymentRequirements: every field is required by the v1 schema,
	// resource is a per-request URL string, and the amount field is named
	// maxAmountRequired.
	const buildRequirementsV1 = (event) => ({
		scheme: "exact",
		network,
		maxAmountRequired: amount,
		resource: buildResource(event),
		description,
		mimeType,
		outputSchema: {},
		payTo,
		maxTimeoutSeconds: 60,
		asset,
		extra: extra ?? {},
	});

	const buildPaymentRequiredV1 = (event, error) => ({
		x402Version: 1,
		error,
		accepts: [buildRequirementsV1(event)],
	});

	// v1 clients read the challenge from the 402 response body, not a header.
	const respondPaymentRequiredV1 = (request, error) => {
		normalizeHttpResponse(request);
		request.response.statusCode = 402;
		request.response.headers["Content-Type"] = "application/json";
		request.response.body = JSON.stringify(
			buildPaymentRequiredV1(request.event, error),
		);
		return request.response;
	};

	const httpX402V2Before = async (request, paymentHeader) => {
		let payload;
		try {
			payload = decodeHeader(paymentHeader);
		} catch {
			// An undecodable header is treated the same as no payment at all.
			return respondPaymentRequired(request, "Payment required");
		}

		if (payload.x402Version !== 2) {
			return respondPaymentRequired(request, "invalid_x402_version");
		}
		if (!matchesAccepted(payload.accepted)) {
			return respondPaymentRequired(
				request,
				"No matching payment requirements",
			);
		}

		let verifyResult;
		try {
			verifyResult = await facilitator.verify(payload, requirements);
		} catch (error) {
			return respondPaymentRequired(request, verifyReason(error));
		}
		if (!verifyResult.isValid) {
			return respondPaymentRequired(request, verifyResult.invalidReason);
		}

		request.internal.x402 = { payload, requirements };
	};

	const httpX402V1Before = async (request, paymentHeader) => {
		let payload;
		try {
			payload = decodeHeader(paymentHeader);
		} catch {
			return respondPaymentRequiredV1(request, "Payment required");
		}

		if (payload.x402Version !== 1) {
			return respondPaymentRequiredV1(request, "invalid_x402_version");
		}
		// v1 payloads carry scheme/network at the top level and echo nothing
		// else; the facilitator verifies the signed value against
		// maxAmountRequired.
		if (
			payload.scheme !== requirements.scheme ||
			payload.network !== requirements.network
		) {
			return respondPaymentRequiredV1(
				request,
				"No matching payment requirements",
			);
		}

		const requirementsV1 = buildRequirementsV1(request.event);
		let verifyResult;
		try {
			verifyResult = await facilitator.verify(payload, requirementsV1);
		} catch (error) {
			return respondPaymentRequiredV1(request, verifyReason(error));
		}
		if (!verifyResult.isValid) {
			return respondPaymentRequiredV1(request, verifyResult.invalidReason);
		}

		request.internal.x402 = { payload, requirements: requirementsV1 };
	};

	const httpX402MiddlewareBefore = (request) => {
		if (human?.(request)) return;

		// A disabled version's payment header is not a payment header for this
		// server; the client falls through and is re-challenged with the
		// enabled formats only.
		const headers = request.event.headers ?? {};
		const v2PaymentHeader = v2Enabled
			? (headers["payment-signature"] ??
				headers["Payment-Signature"] ??
				headers["PAYMENT-SIGNATURE"])
			: undefined;
		if (v2PaymentHeader) {
			return httpX402V2Before(request, v2PaymentHeader);
		}
		const v1PaymentHeader = v1Enabled
			? (headers["x-payment"] ?? headers["X-Payment"] ?? headers["X-PAYMENT"])
			: undefined;
		if (v1PaymentHeader) {
			return httpX402V1Before(request, v1PaymentHeader);
		}

		// Unknown client generation: challenge with every enabled format at
		// once - v2 clients read the PAYMENT-REQUIRED header, v1 clients read
		// the body, so the formats never conflict.
		if (v2Enabled) {
			normalizeHttpResponse(request);
			const paymentRequired = buildPaymentRequired(
				request.event,
				"PAYMENT-SIGNATURE header is required",
			);
			request.response.statusCode = 402;
			request.response.headers["Content-Type"] = "application/json";
			request.response.headers["PAYMENT-REQUIRED"] =
				encodeHeader(paymentRequired);
			request.response.body = JSON.stringify(
				v1Enabled
					? buildPaymentRequiredV1(
							request.event,
							"X-PAYMENT header is required",
						)
					: paymentRequired,
			);
			return request.response;
		}
		return respondPaymentRequiredV1(request, "X-PAYMENT header is required");
	};

	const httpX402MiddlewareAfter = async (request) => {
		const stored = request.internal.x402;
		if (!stored) return;

		normalizeHttpResponse(request);
		if (request.response.statusCode >= 400) return;

		const { payload, requirements: storedRequirements } = stored;
		// v1 settlements are reported in X-PAYMENT-RESPONSE, v2 in
		// PAYMENT-RESPONSE.
		const responseHeader =
			payload.x402Version === 1 ? "X-PAYMENT-RESPONSE" : "PAYMENT-RESPONSE";
		let settleResult;
		try {
			settleResult = await facilitator.settle(payload, storedRequirements);
		} catch (error) {
			const settleResponse = {
				success: false,
				errorReason: settleReason(error),
				// settlement_pending MUST carry the broadcast hash so the client
				// can reconcile on chain; forward it when the thrown error has one.
				transaction:
					typeof error?.transaction === "string" ? error.transaction : "",
				network: storedRequirements.network,
			};
			request.response.statusCode = 402;
			request.response.headers["Content-Type"] = "application/json";
			request.response.headers[responseHeader] = encodeHeader(settleResponse);
			request.response.body = JSON.stringify({
				x402Version: payload.x402Version,
				error: settleResponse.errorReason,
			});
			// The handler's response is replaced in place; a stale
			// isBase64Encoded from a binary body would make API Gateway
			// base64-decode this JSON.
			request.response.isBase64Encoded = false;
			return;
		}

		if (!settleResult.success) {
			request.response.statusCode = 402;
			request.response.headers["Content-Type"] = "application/json";
			request.response.headers[responseHeader] = encodeHeader(settleResult);
			request.response.body = JSON.stringify({
				x402Version: payload.x402Version,
				error: settleResult.errorReason,
			});
			request.response.isBase64Encoded = false;
			return;
		}

		request.internal.x402 = {
			...stored,
			payer: settleResult.payer,
			transaction: settleResult.transaction,
			network: settleResult.network,
		};
		request.response.headers[responseHeader] = encodeHeader(settleResult);
	};

	return {
		before: httpX402MiddlewareBefore,
		after: httpX402MiddlewareAfter,
	};
};

// Facilitator clients throw errors carrying `invalidReason` / `errorReason`
// when the facilitator rejected the request; forward that reason without
// leaking the error message.
const verifyReason = (error) =>
	typeof error?.invalidReason === "string"
		? error.invalidReason
		: "unexpected_verify_error";

const settleReason = (error) =>
	typeof error?.errorReason === "string"
		? error.errorReason
		: "unexpected_settle_error";

const integerPattern = /^[0-9]+$/;

// Render a finite number as a plain decimal string. `String(n)` uses exponential
// notation for magnitudes below 1e-6 or at/above 1e21 (e.g. "1e-7"), which the
// decimal parser below would reject even though the value is a valid price.
const expandExponential = (value) => {
	const s = String(value);
	const eIdx = s.indexOf("e");
	if (eIdx === -1) return s;
	const exp = Number(s.slice(eIdx + 1));
	const [intPart, fracPart = ""] = s.slice(0, eIdx).split(".");
	const digits = intPart + fracPart;
	const point = intPart.length + exp;
	// JS only uses exponential notation for magnitudes < 1e-6 (point <= 0, a pure
	// fraction) or >= 1e21 (point >= digits.length, a trailing-zero integer), so
	// the decimal point never lands inside `digits`.
	// Stryker disable next-line EqualityOperator: point===0 is unreachable. JS only emits exponential notation for magnitudes < 1e-6, so the smallest exponent is -7 with intPart.length >= 1, giving point <= -6; the <= vs < boundary at 0 can never be exercised.
	return point <= 0
		? `0.${"0".repeat(-point)}${digits}`
		: `${digits}${"0".repeat(point - digits.length)}`;
};

const toAtomicAmount = (price, decimals, amountOverride) => {
	if (amountOverride !== undefined) {
		if (!integerPattern.test(amountOverride)) {
			throw new Error(`${pkg} amount must be a non-negative integer string`, {
				cause: { package: pkg },
			});
		}
		return amountOverride;
	}

	const priceString =
		typeof price === "number" ? expandExponential(price) : String(price);
	const match = /^([0-9]*)(?:\.([0-9]+))?$/.exec(priceString);
	if (!match || (match[1] === "" && match[2] === undefined)) {
		throw new Error(
			`${pkg} price must be a non-negative decimal string or number`,
			{ cause: { package: pkg } },
		);
	}

	const whole = match[1];
	const fraction = match[2] ?? "";
	if (fraction.length > decimals) {
		throw new Error(
			`${pkg} price has more fractional digits than decimals (${decimals})`,
			{ cause: { package: pkg } },
		);
	}

	const padded = fraction.padEnd(decimals, "0");
	// `whole` and `padded` are digit-only (regex above) and never both empty
	// (the empty-string price is rejected earlier), so BigInt and its String()
	// form are always a non-negative integer string matching integerPattern:
	// no exponential notation, no precision loss.
	return String(BigInt(`${whole}${padded}`));
};

const buildResource = (event) => {
	if (event.version === "2.0") {
		return `https://${event.requestContext.domainName}${event.requestContext.http.path}`;
	}
	const host = event.requestContext?.domainName ?? "localhost";
	const path = event.requestContext?.path ?? "/";
	return `https://${host}${path}`;
};

const encodeHeader = (obj) =>
	Buffer.from(JSON.stringify(obj)).toString("base64");

const decodeHeader = (header) => {
	const payload = JSON.parse(Buffer.from(header, "base64").toString());
	if (
		payload === null ||
		typeof payload !== "object" ||
		Array.isArray(payload)
	) {
		// Stryker disable next-line StringLiteral,ObjectLiteral: the before-hook catch block discards this error entirely (only a generic "Payment required" 402 is returned), so the message and cause are never observable.
		throw new Error(`${pkg} payment payload must be an object`, {
			// Stryker disable next-line ObjectLiteral: see above; cause is unobservable because the thrown error is swallowed.
			cause: { package: pkg },
		});
	}
	return payload;
};

export default httpX402Middleware;
