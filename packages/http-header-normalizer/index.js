// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { reservedPropertyNames, validateOptions } from "@middy/util";

const name = "http-header-normalizer";
const pkg = `@middy/${name}`;

// RFC 9110 section 5.6.2: "token = 1*tchar"
// https://www.rfc-editor.org/rfc/rfc9110#section-5.6.2
const headerNameSchema = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\w!#$%&'*+.^`|~-]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};

// RFC 9110 section 5.5: field-vchar, SP and HTAB
// https://www.rfc-editor.org/rfc/rfc9110#section-5.5
const headerValueSchema = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\t\x20-\x7E]*$/u,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:http-header-normalizer:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		canonical: { type: "boolean" },
		defaultHeaders: {
			type: "object",
			propertyNames: headerNameSchema,
			maxProperties: 1024,
			required: [],
			additionalProperties: {
				...headerValueSchema,
				type: ["string", "array"],
				items: headerValueSchema,
				maxItems: 1024,
				uniqueItems: true,
				unevaluatedItems: false,
			},
			unevaluatedProperties: false,
		},
		normalizeHeaderKey: { $ref: "#/$defs/Function" },
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const httpHeaderNormalizerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const exceptionsList = [
	"ALPN",
	"C-PEP",
	"C-PEP-Info",
	"CalDAV-Timezones",
	"Content-ID",
	"Content-MD5",
	"DASL",
	"DAV",
	"DNT",
	"ETag",
	"GetProfile",
	"HTTP2-Settings",
	"Last-Event-ID",
	"MIME-Version",
	"NEL",
	"Optional-WWW-Authenticate",
	"Sec-WebSocket-Accept",
	"Sec-WebSocket-Extensions",
	"Sec-WebSocket-Key",
	"Sec-WebSocket-Protocol",
	"Sec-WebSocket-Version",
	"SLUG",
	"TCN",
	"TE",
	"TTL",
	"WWW-Authenticate",
	"X-ATT-DeviceId",
	"X-DNSPrefetch-Control",
	"X-UIDH",
];

const exceptions = exceptionsList.reduce((acc, curr) => {
	acc[curr.toLowerCase()] = curr;
	return acc;
}, {});

const normalizeHeaderKey = (key, canonical) => {
	const lowerCaseKey = key.toLowerCase();
	if (!canonical) {
		return lowerCaseKey;
	}

	if (Object.hasOwn(exceptions, lowerCaseKey)) {
		return exceptions[lowerCaseKey];
	}

	return lowerCaseKey
		.split("-")
		.map((text) => (text[0] || "").toUpperCase() + text.substring(1))
		.join("-");
};

const defaults = {
	canonical: false,
	defaultHeaders: {},
	normalizeHeaderKey,
};

export const NORMALIZED_KEY_CACHE_MAX = 2000;

const httpHeaderNormalizerMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const normalizedKeyCache = new Map();
	const cachedNormalizeKey = (key) => {
		let normalized = normalizedKeyCache.get(key);
		if (normalized === undefined) {
			normalized = options.normalizeHeaderKey(key, options.canonical);
			if (normalizedKeyCache.size >= NORMALIZED_KEY_CACHE_MAX) {
				normalizedKeyCache.delete(normalizedKeyCache.keys().next().value);
			}
			normalizedKeyCache.set(key, normalized);
		}
		return normalized;
	};

	const defaultHeaders = {};
	const defaultMultiValueHeaders = {};
	for (const key of Object.keys(options.defaultHeaders)) {
		const newKey = cachedNormalizeKey(key);
		const value = options.defaultHeaders[key];
		// Cookie pairs are separated by "; " (RFC 6265 §5.4); every other
		// repeated field by "," (RFC 9110 §5.3).
		const isCookie = key.toLowerCase() === "cookie";
		if (Array.isArray(value)) {
			defaultHeaders[newKey] = value.join(isCookie ? "; " : ",");
			defaultMultiValueHeaders[newKey] = value;
		} else {
			defaultHeaders[newKey] = value;
			defaultMultiValueHeaders[newKey] = value
				.split(isCookie ? ";" : ",")
				.map((part) => part.trim());
		}
	}

	const httpHeaderNormalizerMiddlewareBefore = (request) => {
		if (request.event.headers) {
			const headers = Object.assign(Object.create(null), defaultHeaders);

			for (const key in request.event.headers) {
				headers[cachedNormalizeKey(key)] = request.event.headers[key];
			}

			request.event.headers = headers;
		}

		if (request.event.multiValueHeaders) {
			const headers = Object.assign(
				Object.create(null),
				defaultMultiValueHeaders,
			);

			for (const key in request.event.multiValueHeaders) {
				headers[cachedNormalizeKey(key)] = request.event.multiValueHeaders[key];
			}

			request.event.multiValueHeaders = headers;
		}
	};

	return {
		before: httpHeaderNormalizerMiddlewareBefore,
	};
};

export default httpHeaderNormalizerMiddleware;
