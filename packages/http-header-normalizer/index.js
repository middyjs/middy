// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
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

const httpHeaderNormalizerMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	// Cache for normalized header keys to avoid repeated split/map/join
	const normalizedKeyCache = new Map();
	const cachedNormalizeKey = (key) => {
		let normalized = normalizedKeyCache.get(key);
		if (normalized === undefined) {
			normalized = options.normalizeHeaderKey(key, options.canonical);
			normalizedKeyCache.set(key, normalized);
		}
		return normalized;
	};

	const defaultHeaders = {};
	const defaultMultiValueHeaders = {};
	for (const key of Object.keys(options.defaultHeaders)) {
		const newKey = cachedNormalizeKey(key);
		const isArray = Array.isArray(options.defaultHeaders[key]);
		defaultHeaders[newKey] = isArray
			? options.defaultHeaders[key].join(",")
			: options.defaultHeaders[key];
		defaultMultiValueHeaders[newKey] = isArray
			? options.defaultHeaders[key]
			: options.defaultHeaders[key].split(",");
	}

	const hasDefaultHeaders = Object.keys(defaultHeaders).length > 0;
	const hasDefaultMultiValueHeaders =
		Object.keys(defaultMultiValueHeaders).length > 0;

	const httpHeaderNormalizerMiddlewareBefore = (request) => {
		if (request.event.headers) {
			const headers = hasDefaultHeaders ? { ...defaultHeaders } : {};

			for (const key in request.event.headers) {
				headers[cachedNormalizeKey(key)] = request.event.headers[key];
			}

			request.event.headers = headers;
		}

		if (request.event.multiValueHeaders) {
			const headers = hasDefaultMultiValueHeaders
				? { ...defaultMultiValueHeaders }
				: {};

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
