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
	amount: undefined,
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
		price,
		amount: amountOverride,
		decimals,
		network,
		payTo,
		asset,
		description,
		mimeType,
		human,
	} = options;

	const amount = toAtomicAmount(price, decimals, amountOverride);
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
		const paymentHeader =
			headers["payment-signature"] ?? headers["Payment-Signature"];

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
			return respond402(request, "invalid_payment");
		}

		if (
			payload.scheme !== requirements.scheme ||
			payload.network !== requirements.network
		) {
			return respond402(request, "invalid_payment");
		}

		let verifyResult;
		try {
			verifyResult = await facilitator.verify(payload, fullRequirements);
		} catch {
			return respond402(request, "invalid_payment");
		}
		if (!verifyResult.isValid) {
			return respond402(request, verifyResult.invalidReason);
		}

		request.internal.x402 = { payload, requirements: fullRequirements };
	};

	const httpX402MiddlewareAfter = async (request) => {
		const stored = request.internal.x402;
		if (!stored) return;

		normalizeHttpResponse(request);
		if (request.response.statusCode >= 400) return;

		const { payload, requirements: fullRequirements } = stored;
		let settleResult;
		try {
			settleResult = await facilitator.settle(payload, fullRequirements);
		} catch {
			request.response.statusCode = 402;
			request.response.headers["Content-Type"] = "application/json";
			request.response.body = JSON.stringify({
				x402Version: 2,
				error: "settle_error",
			});
			return;
		}

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

const respond402 = (request, error) => {
	normalizeHttpResponse(request);
	request.response.statusCode = 402;
	request.response.headers["Content-Type"] = "application/json";
	request.response.body = JSON.stringify({ x402Version: 2, error });
	return request.response;
};

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
		// Stryker disable next-line ConditionalExpression: a non-null, non-array primitive that slips past this check has no matching scheme, so the scheme/network guard returns the same invalid_payment 402; forcing this operand false is therefore unobservable.
		typeof payload !== "object" ||
		Array.isArray(payload)
	) {
		// Stryker disable next-line StringLiteral,ObjectLiteral: the before-hook catch block discards this error entirely (only a generic invalid_payment 402 is returned), so the message and cause are never observable.
		throw new Error(`${pkg} payment payload must be an object`, {
			// Stryker disable next-line ObjectLiteral: see above; cause is unobservable because the thrown error is swallowed.
			cause: { package: pkg },
		});
	}
	return payload;
};

export default httpX402Middleware;
