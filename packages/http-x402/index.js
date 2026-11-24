// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { HttpError, normalizeHttpResponse, validateOptions } from "@middy/util";
import {
	FacilitatorResponseError,
	FacilitatorTimeoutError,
	HTTPFacilitatorClient,
} from "@x402/core/http";

const name = "http-x402";
const pkg = `@middy/${name}`;

const defaults = {
	FacilitatorClient: HTTPFacilitatorClient,
	facilitatorUrl: undefined,
	// v1 acceptance is opt-in (smaller attack surface, no legacy facilitator
	// path): pass `versions: [1, 2]` to also accept the X-PAYMENT v1 flow.
	versions: [2],
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

const textSchema = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\p{L}\p{N}\p{P}\p{S} ]*$/u,
};

const visibleSchema = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
};

const decimalSchema = { type: "string", maxLength: 1024, pattern: /^\d+$/u };

const httpsUrlSchema = {
	type: "string",
	maxLength: 1024,
	pattern: /^https:\/\/[\x21-\x7E]+$/u,
};

// The `extra` keys of the `exact` scheme on each network, leaving out
// `paymentFlow` and `assetTransferMethod`, which select flows this middleware
// does not run.
// https://github.com/coinbase/x402/tree/0e6e8c55d86b4f14234fb6e49a4052074fb93e57/specs/schemes/exact
const extraSchema = {
	type: "object",
	properties: {
		// EVM (EIP-3009) and Casper: the EIP-712 domain name and version.
		name: { ...textSchema, minLength: 1 },
		version: { ...textSchema, minLength: 1 },
		// SVM, Algorand, Aptos, Concordium, Hedera and Starknet.
		feePayer: visibleSchema,
		// SVM: "A seller-defined UTF-8 string ... Maximum 256 bytes."
		memo: { ...textSchema, maxLength: 256 },
		recentBlockhash: visibleSchema,
		// SVM: "as a decimal string".
		lastValidBlockHeight: decimalSchema,
		// Keeta.
		external: visibleSchema,
		// Stellar, TON, XRPL and Cardano.
		areFeesSponsored: { type: "boolean" },
		// Sui: the gas station URL.
		gasStation: httpsUrlSchema,
		// TON: an address, a base64-encoded cell and an amount of nanotons.
		responseDestination: visibleSchema,
		forwardPayload: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\w+/=-]+$/u,
		},
		forwardTonAmount: decimalSchema,
		// XRPL: DestinationTag is a UInt32.
		// https://xrpl.org/docs/references/protocol/transactions/types/payment
		invoiceId: { ...textSchema, minLength: 1 },
		destinationTag: { type: "integer", minimum: 0, maximum: 4294967295 },
		issuer: visibleSchema,
		// Cardano: "`confirmationPolicy.l1Confirmations` is an integer from `-1`
		// through `20`".
		confirmationPolicy: {
			type: "object",
			properties: {
				l1Confirmations: { type: "integer", minimum: -1, maximum: 20 },
			},
			required: [],
			additionalProperties: false,
			unevaluatedProperties: false,
		},
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:http-x402:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		FacilitatorClient: { $ref: "#/$defs/Function" },
		facilitatorUrl: httpsUrlSchema,
		versions: {
			type: "array",
			items: { type: "integer", enum: [1, 2] },
			minItems: 1,
			maxItems: 2,
			uniqueItems: true,
			unevaluatedItems: false,
		},
		price: {
			oneOf: [
				{
					type: "number",
					exclusiveMinimum: 0,
					maximum: Number.MAX_SAFE_INTEGER,
				},
				{
					type: "string",
					maxLength: 1024,
					pattern: /^(\d+(\.\d+)?|\.\d+)$/u,
				},
			],
		},
		amount: decimalSchema,
		// EIP-20: `function decimals() public view returns (uint8)`.
		// https://eips.ethereum.org/EIPS/eip-20
		decimals: { type: "integer", minimum: 0, maximum: 255 },
		// CAIP-2: `[-a-z0-9]{3,8}` namespace, `:`, `[-_a-zA-Z0-9]{1,32}` reference.
		// https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
		network: {
			type: "string",
			maxLength: 41,
			pattern: /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/u,
		},
		payTo: visibleSchema,
		asset: visibleSchema,
		description: textSchema,
		// RFC 6838 section 4.2: type and subtype names are at most 127 characters.
		mimeType: {
			type: "string",
			maxLength: 255,
			pattern: /^[\w.+-]{1,127}\/[\w.+-]{1,127}$/u,
		},
		extra: extraSchema,
		human: { $ref: "#/$defs/Function" },
	},
	required: ["payTo", "asset", "facilitatorUrl"],
	additionalProperties: false,
	unevaluatedProperties: false,
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

	// @x402/core's HTTPFacilitatorClient falls back to its default facilitator,
	// https://x402.org/facilitator, when `url` is empty (@x402/core 2.29.0).
	if (typeof facilitatorUrl !== "string" || facilitatorUrl === "") {
		throw new Error(`${pkg} facilitatorUrl is required`, {
			cause: { package: pkg },
		});
	}

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
		return albMultiValueResponse(request);
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
		return albMultiValueResponse(request);
	};

	const verifyPayment = async (payload, paymentRequirements) => {
		try {
			return await facilitator.verify(payload, paymentRequirements);
		} catch (error) {
			if (error instanceof FacilitatorResponseError) {
				throw exposedFacilitatorGatewayError("verify", error);
			}
			return { isValid: false, invalidReason: verifyReason(error) };
		}
	};

	const httpX402V2Before = async (request, paymentHeader) => {
		// An undecodable header is treated the same as no payment at all.
		const payload = decodeHeader(paymentHeader);
		if (payload === undefined) {
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

		const verifyResult = await verifyPayment(payload, requirements);
		if (!verifyResult.isValid) {
			return respondPaymentRequired(request, verifyResult.invalidReason);
		}

		request.internal.x402 = { payload, requirements };
	};

	const httpX402V1Before = async (request, paymentHeader) => {
		const payload = decodeHeader(paymentHeader);
		if (payload === undefined) {
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
		const verifyResult = await verifyPayment(payload, requirementsV1);
		if (!verifyResult.isValid) {
			return respondPaymentRequiredV1(request, verifyResult.invalidReason);
		}

		request.internal.x402 = { payload, requirements: requirementsV1 };
	};

	const httpX402MiddlewareBefore = (request) => {
		// Only a literal `true` bypasses payment. An async callback returns a
		// Promise, which is always truthy, so it would skip payment for every
		// request; reject it loudly instead of failing open.
		const isHuman = human?.(request);
		if (typeof isHuman?.then === "function") {
			throw new TypeError(`${pkg} human must return a boolean, not a Promise`, {
				cause: { package: pkg },
			});
		}
		if (isHuman === true) return;

		// A disabled version's payment header is not a payment header for this
		// server; the client falls through and is re-challenged with the
		// enabled formats only.
		// ALB with multi-value headers enabled sends only `multiValueHeaders`.
		// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers
		const headers =
			request.event.headers ?? request.event.multiValueHeaders ?? {};
		const v2PaymentHeader = v2Enabled
			? readHeader(headers, "payment-signature")
			: undefined;
		if (v2PaymentHeader) {
			return httpX402V2Before(request, v2PaymentHeader);
		}
		const v1PaymentHeader = v1Enabled
			? readHeader(headers, "x-payment")
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
			return albMultiValueResponse(request);
		}
		return respondPaymentRequiredV1(request, "X-PAYMENT header is required");
	};

	const httpX402MiddlewareAfter = async (request) => {
		const stored = request.internal.x402;
		if (!stored) return;

		normalizeHttpResponse(request);
		if (request.response.statusCode >= 400) return;

		const { payload, requirements: storedRequirements } = stored;
		// Decided by the event, not the handler's response: API Gateway REST
		// accepts `headers` and `multiValueHeaders` side by side, ALB does not.
		const multiValue = isAlbMultiValue(request.event);
		// v1 settlements are reported in X-PAYMENT-RESPONSE, v2 in
		// PAYMENT-RESPONSE.
		const responseHeader =
			payload.x402Version === 1 ? "X-PAYMENT-RESPONSE" : "PAYMENT-RESPONSE";
		const settlePayment = async () => {
			try {
				return await facilitator.settle(payload, storedRequirements);
			} catch (error) {
				if (error instanceof FacilitatorResponseError) {
					throw exposedFacilitatorGatewayError("settle", error);
				}
				return {
					success: false,
					errorReason: settleReason(error),
					// settlement_pending MUST carry the broadcast hash so the client
					// can reconcile on chain; forward it when the thrown error has one.
					transaction:
						typeof error?.transaction === "string" ? error.transaction : "",
					network: storedRequirements.network,
				};
			}
		};

		let settleResult = await settlePayment();
		// A `settlement_pending` failure with a transaction hash was broadcast but
		// not confirmed. Settling the same payload again lets the facilitator
		// reconcile against that transaction instead of broadcasting another.
		// @x402/core's x402ResourceServer retries exactly once
		// (`settleWithPendingRetry`, @x402/core 2.29.0).
		if (isSettlementPending(settleResult)) {
			settleResult = await settlePayment();
		}

		if (!settleResult.success) {
			request.response = settlementRefused(
				payload,
				responseHeader,
				settleResult,
				request.response,
				multiValue,
			);
			return;
		}

		request.internal.x402 = {
			...stored,
			payer: settleResult.payer,
			transaction: settleResult.transaction,
			network: settleResult.network,
		};
		if (multiValue) {
			request.response.multiValueHeaders ??= {};
			request.response.multiValueHeaders[responseHeader] = [
				encodeHeader(settleResult),
			];
		} else {
			request.response.headers[responseHeader] = encodeHeader(settleResult);
		}
	};

	return {
		before: httpX402MiddlewareBefore,
		after: httpX402MiddlewareAfter,
	};
};

// Field names are case-insensitive (RFC 9110 §5.1) and API Gateway REST passes
// the client's casing through. ALB multi-value and VPC Lattice V2 deliver
// arrays; the first value is the one used.
const readHeader = (headers, lowerName) => {
	for (const key of Object.keys(headers)) {
		if (key.toLowerCase() === lowerName) {
			const value = headers[key];
			return Array.isArray(value) ? value[0] : value;
		}
	}
	return undefined;
};

// Response-policy headers, not content: CORS (so a browser can read the 402 at
// all), `Vary`, and what http-security-headers sets. When those middlewares are
// .use()d after this one, their after hooks have already run on the handler's
// response, so they are carried over to the 402.
const policyHeaderNames = new Set([
	"vary",
	"strict-transport-security",
	"x-content-type-options",
	"x-frame-options",
	"x-dns-prefetch-control",
	"x-download-options",
	"x-permitted-cross-domain-policies",
	"x-xss-protection",
	"referrer-policy",
	"permissions-policy",
	"origin-agent-cluster",
	"reporting-endpoints",
	"report-to",
	"content-security-policy",
	"content-security-policy-report-only",
]);
const isPolicyHeader = (name) => {
	const lower = name.toLowerCase();
	return (
		policyHeaderNames.has(lower) ||
		lower.startsWith("access-control-") ||
		lower.startsWith("cross-origin-")
	);
};

// Payment was not taken, so nothing the handler produced for the paid resource
// may reach the client: not its body, and not its content headers, multi-value
// headers or v2 cookies (Location, Set-Cookie). The handler's response is
// replaced whole rather than patched; only policy headers are kept.
const settlementRefused = (
	payload,
	responseHeader,
	settlement,
	replaced,
	multiValue,
) => {
	const headers = {};
	for (const map of [replaced.headers, replaced.multiValueHeaders]) {
		if (!map) continue;
		for (const name of Object.keys(map)) {
			if (!isPolicyHeader(name)) continue;
			// Single-value `headers` cannot carry a `multiValueHeaders` array.
			const value = map[name];
			headers[name] =
				!multiValue && Array.isArray(value) ? value.join(", ") : value;
		}
	}
	headers["Content-Type"] = "application/json";
	headers[responseHeader] = encodeHeader(settlement);
	const response = {
		statusCode: 402,
		headers,
		body: JSON.stringify({
			x402Version: payload.x402Version,
			error: settlement.errorReason,
		}),
		isBase64Encoded: false,
	};
	return multiValue ? toMultiValueHeaders(response) : response;
};

// An ALB target group with multi-value headers enabled sends
// `multiValueHeaders` and only reads them back: "You must use
// multiValueHeaders if you have enabled multi-value headers and headers
// otherwise." Its events are the only ones that carry `requestContext.elb`
// together with `multiValueHeaders`.
// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers
const isAlbMultiValue = (event) =>
	event.requestContext?.elb !== undefined &&
	event.multiValueHeaders !== undefined;

const toMultiValueHeaders = ({ headers, ...response }) => {
	const multiValueHeaders = {};
	for (const name of Object.keys(headers)) {
		const value = headers[name];
		multiValueHeaders[name] = Array.isArray(value) ? value : [value];
	}
	return { ...response, multiValueHeaders };
};

const albMultiValueResponse = (request) => {
	if (isAlbMultiValue(request.event)) {
		request.response = toMultiValueHeaders(request.response);
	}
	return request.response;
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

// @x402/core raises `FacilitatorResponseError` when the facilitator's answer
// cannot be read, and its subclass `FacilitatorTimeoutError` when the answer
// did not come in time. The reference server rethrows both instead of
// answering 402 (@x402/core 2.29.0, src/http/x402HTTPResourceServer.ts,
// `processHTTPRequest` and `processSettlement`).
const exposedFacilitatorGatewayError = (operation, error) =>
	new HttpError(error instanceof FacilitatorTimeoutError ? 504 : 502, {
		expose: true,
		cause: {
			package: pkg,
			data: { reason: `Facilitator ${operation} failed: ${error.message}` },
		},
	});

const isSettlementPending = (settleResult) =>
	!settleResult.success &&
	settleResult.errorReason === "settlement_pending" &&
	Boolean(settleResult.transaction);

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

// The host comes only from API Gateway's `requestContext.domainName`; the Host
// header is client-controlled and never used. ALB and VPC Lattice carry no
// trusted domain, so they get `localhost`, with the request path from the
// event: `path` (ALB, Lattice V2) or `raw_path` (Lattice V1). Lattice includes
// the query string in both, which is not part of the resource. Lattice V2 also
// sends `version: "2.0"`, so the payload is told apart by
// `requestContext.http`, which only API Gateway HTTP API v2 and function URL
// events carry.
// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html
// https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html
const buildResource = (event) => {
	const requestContext = event.requestContext;
	if (requestContext?.http) {
		return `https://${requestContext.domainName}${requestContext.http.path}`;
	}
	if (requestContext?.domainName) {
		return `https://${requestContext.domainName}${requestContext.path ?? "/"}`;
	}
	const rawPath = requestContext?.path ?? event.path ?? event.raw_path;
	const path = typeof rawPath === "string" ? rawPath.split("?", 1)[0] : "";
	return `https://localhost${path || "/"}`;
};

const encodeHeader = (obj) =>
	Buffer.from(JSON.stringify(obj)).toString("base64");

// Undefined for anything that is not a JSON object: bad base64, bad JSON, or a
// well-formed payload of the wrong shape. The callers cannot tell those apart,
// so the reason is not worth building.
const decodeHeader = (header) => {
	let payload;
	try {
		payload = JSON.parse(Buffer.from(header, "base64").toString());
	} catch {
		// Bad base64 or bad JSON leaves `payload` undefined, which the shape
		// check below rejects like any other non-object.
	}
	if (
		payload === null ||
		typeof payload !== "object" ||
		Array.isArray(payload)
	) {
		return undefined;
	}
	return payload;
};

export default httpX402Middleware;
