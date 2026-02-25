// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { normalizeHttpResponse } from "@middy/util";

const hostnameToPunycode = (hostname) => {
	const placeholder = "-_ANY_-";
	const tempHostname = hostname.replace(/\*/g, placeholder);
	try {
		const url = new URL(`https://${tempHostname}`);
		return url.host.replaceAll(placeholder.toLowerCase(), "*");
	} catch {
		return hostname;
	}
};

const originToPunycode = (origin) => {
	if (!origin || origin === "*") return origin;
	const match = origin.match(/^(https?:\/\/)(.+)$/);
	if (!match) return origin;
	const [, protocol, host] = match;
	return protocol + hostnameToPunycode(host);
};

// CORS-safelisted request headers
// https://developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_request_header
const corsSafelistedRequestHeaders = [
	"accept",
	"accept-language",
	"content-language",
	"content-type",
	"range",
];

const defaults = {
	disableBeforePreflightResponse: true,
	getOrigin: undefined, // default inserted below
	credentials: undefined,
	headers: undefined,
	methods: undefined,
	origin: undefined,
	origins: [],
	exposeHeaders: undefined,
	maxAge: undefined,
	requestHeaders: undefined,
	requestMethods: undefined,
	cacheControl: undefined,
	vary: undefined,
};

const httpCorsMiddleware = (opts = {}) => {
	const getOrigin = (incomingOrigin, options = {}) => {
		if (options.origins.length > 0) {
			if (originStatic[incomingOrigin]) {
				return incomingOrigin;
			}
			if (originAny) {
				if (options.credentials) {
					return incomingOrigin;
				}
				return "*";
			}
			if (originDynamic.some((regExp) => regExp.test(incomingOrigin))) {
				return incomingOrigin;
			}
		} else {
			if (incomingOrigin && options.credentials && options.origin === "*") {
				return incomingOrigin;
			}
			return options.origin;
		}
		return null;
	};
	const options = {
		...defaults,
		getOrigin,
		...opts,
	};

	if (
		options.requestHeaders !== undefined &&
		!Array.isArray(options.requestHeaders)
	) {
		throw new Error("requestHeaders must be an array", {
			cause: { package: "@middy/http-cors" },
		});
	}
	if (
		options.requestMethods !== undefined &&
		!Array.isArray(options.requestMethods)
	) {
		throw new Error("requestMethods must be an array", {
			cause: { package: "@middy/http-cors" },
		});
	}
	options.requestHeaders = options.requestHeaders?.map((v) => v.toLowerCase());
	options.requestMethods = options.requestMethods?.map((v) => v.toUpperCase());

	let originAny = false;
	let originMany = options.origins.length > 1;
	const originStatic = {};
	const originDynamic = [];

	for (let origin of [options.origin, ...options.origins]) {
		if (!origin) {
			continue;
		}
		origin = originToPunycode(origin);
		// All
		if (origin === "*") {
			originAny = true;
			continue;
		}
		// Static
		if (!origin.includes("*")) {
			originStatic[origin] = true;
			continue;
		}
		originMany = true;
		// Dynamic
		const regExpStr = origin
			.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
			.replaceAll("*", "[^.]*");
		// SAST Skipped: Not accessible by users
		// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
		originDynamic.push(new RegExp(`^${regExpStr}$`));
	}

	const modifyHeaders = (headers, options, request) => {
		const existingHeaders = Object.keys(headers);
		if (existingHeaders.includes("Access-Control-Allow-Credentials")) {
			options.credentials =
				headers["Access-Control-Allow-Credentials"] === "true";
		}
		if (options.credentials) {
			headers["Access-Control-Allow-Credentials"] = String(options.credentials);
		}
		if (
			options.headers &&
			!existingHeaders.includes("Access-Control-Allow-Headers")
		) {
			headers["Access-Control-Allow-Headers"] = options.headers;
		}
		if (
			options.methods &&
			!existingHeaders.includes("Access-Control-Allow-Methods")
		) {
			headers["Access-Control-Allow-Methods"] = options.methods;
		}

		let newOrigin;
		if (!existingHeaders.includes("Access-Control-Allow-Origin")) {
			const eventHeaders = request.event.headers ?? {};
			const incomingOrigin = eventHeaders.Origin ?? eventHeaders.origin;
			newOrigin = options.getOrigin(incomingOrigin, options);
			if (newOrigin) {
				headers["Access-Control-Allow-Origin"] = newOrigin;
			}
		}

		if (!headers.Vary) {
			addHeaderPart(headers, "Vary", options.vary);
		}

		if (
			originMany ||
			(originAny && newOrigin !== "*") ||
			(newOrigin === "*" && options.credentials)
		) {
			addHeaderPart(headers, "Vary", "Origin");
		}

		if (
			options.exposeHeaders &&
			!existingHeaders.includes("Access-Control-Expose-Headers")
		) {
			headers["Access-Control-Expose-Headers"] = options.exposeHeaders;
		}
		if (options.maxAge && !existingHeaders.includes("Access-Control-Max-Age")) {
			headers["Access-Control-Max-Age"] = String(options.maxAge);
		}
		const httpMethod = getVersionHttpMethod[request.event.version ?? "1.0"]?.(
			request.event,
		);
		if (
			httpMethod === "OPTIONS" &&
			options.cacheControl &&
			!existingHeaders.includes("Cache-Control")
		) {
			headers["Cache-Control"] = options.cacheControl;
		}
	};

	const httpCorsMiddlewareBefore = async (request) => {
		if (options.disableBeforePreflightResponse) return;

		const method = getVersionHttpMethod[request.event.version ?? "1.0"]?.(
			request.event,
		);
		if (method === "OPTIONS") {
			normalizeHttpResponse(request);
			const eventHeaders = request.event.headers ?? {};
			const requestMethod =
				eventHeaders["Access-Control-Request-Method"] ??
				eventHeaders["access-control-request-method"];

			if (options.requestMethods?.length && requestMethod) {
				if (!options.requestMethods.includes(requestMethod)) {
					request.response.statusCode = 204;
					request.response.headers = {};
					return request.response;
				}
			}

			const requestHeadersValue =
				eventHeaders["Access-Control-Request-Headers"] ??
				eventHeaders["access-control-request-headers"];

			if (options.requestHeaders?.length && requestHeadersValue) {
				const requestedHeaders = requestHeadersValue
					.split(",")
					.map((h) => h.trim().toLowerCase());
				const nonSafelistedHeaders = requestedHeaders.filter(
					(h) => !corsSafelistedRequestHeaders.includes(h),
				);
				const hasDisallowedHeader = nonSafelistedHeaders.some(
					(h) => !options.requestHeaders.includes(h),
				);
				if (hasDisallowedHeader) {
					request.response.statusCode = 204;
					request.response.headers = {};
					return request.response;
				}
			}

			const headers = {};
			modifyHeaders(headers, options, request);
			request.response.headers = headers;
			request.response.statusCode = 204;
			return request.response;
		}
	};

	const httpCorsMiddlewareAfter = async (request) => {
		normalizeHttpResponse(request);
		const headers = structuredClone(request.response.headers);
		modifyHeaders(headers, options, request);
		request.response.headers = headers;
	};
	const httpCorsMiddlewareOnError = async (request) => {
		if (typeof request.response === "undefined") return;
		await httpCorsMiddlewareAfter(request);
	};
	return {
		before: httpCorsMiddlewareBefore,
		after: httpCorsMiddlewareAfter,
		onError: httpCorsMiddlewareOnError,
	};
};
const getVersionHttpMethod = {
	"1.0": (event) => event.httpMethod,
	"2.0": (event) => event.requestContext.http.method,
};

// header in official name, lowercase variant handled
const addHeaderPart = (headers, header, value) => {
	if (!value) return;
	const headerLower = header.toLowerCase();
	const sanitizedHeader = headers[headerLower] ? headerLower : header;
	headers[sanitizedHeader] ??= "";
	headers[sanitizedHeader] &&= `${headers[sanitizedHeader]}, `;
	headers[sanitizedHeader] += value;
};

export default httpCorsMiddleware;
