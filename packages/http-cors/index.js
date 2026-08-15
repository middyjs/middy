// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { normalizeHttpResponse, validateOptions } from "@middy/util";

const name = "http-cors";
const pkg = `@middy/${name}`;

const optionSchema = {
	type: "object",
	properties: {
		disableBeforePreflightResponse: { type: "boolean" },
		getOrigin: { instanceof: "Function" },
		credentials: { oneOf: [{ type: "boolean" }, { type: "string" }] },
		headers: { type: "string" },
		methods: {
			type: "string",
			pattern: "^\\s*(\\*|[A-Z]+)(\\s*,\\s*(\\*|[A-Z]+))*\\s*$",
			// Stryker disable next-line StringLiteral,ArrayDeclaration: JSON Schema `examples` is an annotation only; it does not affect validation, so mutating its contents cannot change observable behavior.
			examples: ["*", "GET", "GET,POST"],
		},
		origin: { type: "string" },
		origins: { type: "array", items: { type: "string" } },
		exposeHeaders: { type: "string" },
		maxAge: {
			oneOf: [{ type: "integer", minimum: 0 }, { type: "string" }],
		},
		requestHeaders: { type: "array", items: { type: "string" } },
		requestMethods: {
			type: "array",
			items: {
				type: "string",
				enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
			},
		},
		cacheControl: { type: "string" },
		vary: { type: "string" },
	},
	additionalProperties: false,
};

export const httpCorsValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

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

// ASCII (no IDN), no port-stripping needed, no `*` wildcard. Hot path: most
// Origin headers in production are plain ASCII URLs that this matches.
const asciiOriginFast = /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i;

const originToPunycode = (origin) => {
	// Stryker disable next-line ConditionalExpression,StringLiteral: "*" fails both the asciiOriginFast regex and the /^(https?:\/\/)(.+)$/ match, so it is returned unchanged downstream regardless; the early-return is a pure fast-path with no observable effect.
	if (!origin || origin === "*") return origin;
	// Fast-path: ASCII origin without wildcard — just canonicalize case.
	// `new URL().host` lowercases the host portion; reproduce that here.
	if (asciiOriginFast.test(origin)) {
		// Lowercase only the scheme+host portion (which is all of it for this regex).
		return origin.toLowerCase();
	}
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
		incomingOrigin = originToPunycode(incomingOrigin);
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
			cause: { package: pkg },
		});
	}
	if (
		options.requestMethods !== undefined &&
		!Array.isArray(options.requestMethods)
	) {
		throw new Error("requestMethods must be an array", {
			cause: { package: pkg },
		});
	}
	options.requestHeaders = options.requestHeaders?.map((v) => v.toLowerCase());
	options.requestMethods = options.requestMethods?.map((v) => v.toUpperCase());

	let originAny = false;
	let originMany = options.origins.length > 1;
	const originStatic = Object.create(null);
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

	// Stryker disable next-line ConditionalExpression: forcing this to `false` is equivalent - it just sends the default getOrigin through the explicit originToPunycode comparison below, which holds by construction for the default (the pre-fast-path behavior, identical results). (The EqualityOperator variant on this line remains active and is killed by the custom-getOrigin reflection tests.)
	const usesDefaultGetOrigin = options.getOrigin === getOrigin;
	const getOriginOptions = { ...options };
	const getOriginOptionsCredentials = { ...options, credentials: true };
	const getOriginOptionsNoCredentials = { ...options, credentials: false };

	const modifyHeaders = (headers, options, request) => {
		let credentials = options.credentials;
		if (Object.hasOwn(headers, "Access-Control-Allow-Credentials")) {
			credentials = headers["Access-Control-Allow-Credentials"] === "true";
		}
		if (credentials) {
			headers["Access-Control-Allow-Credentials"] = String(credentials);
		}
		if (
			options.headers &&
			!Object.hasOwn(headers, "Access-Control-Allow-Headers")
		) {
			headers["Access-Control-Allow-Headers"] = options.headers;
		}
		if (
			options.methods &&
			!Object.hasOwn(headers, "Access-Control-Allow-Methods")
		) {
			headers["Access-Control-Allow-Methods"] = options.methods;
		}

		let newOrigin;
		let reflectsRequestOrigin = false;
		if (!Object.hasOwn(headers, "Access-Control-Allow-Origin")) {
			const eventHeaders = request.event.headers ?? {};
			const incomingOrigin = eventHeaders.Origin ?? eventHeaders.origin;
			newOrigin = options.getOrigin(
				incomingOrigin,
				credentials === true
					? getOriginOptionsCredentials
					: credentials === false
						? getOriginOptionsNoCredentials
						: getOriginOptions,
			);
			if (newOrigin) {
				headers["Access-Control-Allow-Origin"] = newOrigin;
			}
			reflectsRequestOrigin =
				options.origins.length > 0 &&
				!!newOrigin &&
				newOrigin !== "*" &&
				(usesDefaultGetOrigin ||
					newOrigin === originToPunycode(incomingOrigin));
		}

		if (!headers.Vary) {
			addHeaderPart(headers, "Vary", options.vary);
		}

		if (
			originMany ||
			(originAny && newOrigin !== "*") ||
			(newOrigin === "*" && credentials) ||
			reflectsRequestOrigin
		) {
			addHeaderPart(headers, "Vary", "Origin");
		}

		if (
			options.exposeHeaders &&
			!Object.hasOwn(headers, "Access-Control-Expose-Headers")
		) {
			headers["Access-Control-Expose-Headers"] = options.exposeHeaders;
		}
		if (options.maxAge && !Object.hasOwn(headers, "Access-Control-Max-Age")) {
			headers["Access-Control-Max-Age"] = String(options.maxAge);
		}
		const httpMethod = getVersionHttpMethod[request.event.version ?? "1.0"]?.(
			request.event,
		);
		if (
			httpMethod === "OPTIONS" &&
			options.cacheControl &&
			!Object.hasOwn(headers, "Cache-Control")
		) {
			headers["Cache-Control"] = options.cacheControl;
		}
	};

	const httpCorsMiddlewareBefore = (request) => {
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

	const httpCorsMiddlewareAfter = (request) => {
		normalizeHttpResponse(request);
		const headers = { ...request.response.headers };
		modifyHeaders(headers, options, request);
		request.response.headers = headers;
	};
	const httpCorsMiddlewareOnError = (request) => {
		if (typeof request.response === "undefined") return;
		httpCorsMiddlewareAfter(request);
	};
	return {
		before: httpCorsMiddlewareBefore,
		after: httpCorsMiddlewareAfter,
		onError: httpCorsMiddlewareOnError,
	};
};
const getVersionHttpMethod = Object.assign(Object.create(null), {
	"1.0": (event) => event.httpMethod,
	"2.0": (event) => event.requestContext.http.method,
});

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
