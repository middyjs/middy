// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createPublicKey } from "node:crypto";
import {
	getInternal,
	HttpError,
	sanitizeKey,
	validateOptions,
} from "@middy/util";
import { V4 } from "paseto";

const name = "http-paseto";
const pkg = `@middy/${name}`;

const defaults = {
	internalKey: undefined,
	tokenCookieName: undefined,
	tokenHeaderName: undefined,
	tokenQueryStringName: undefined,
	audience: undefined,
	issuer: undefined,
	clockTolerance: undefined,
	maxTokenAge: undefined,
	payloadKey: "paseto",
	setToContext: false,
};

const optionSchema = {
	type: "object",
	properties: {
		internalKey: { type: "string" },
		tokenCookieName: { type: "string" },
		tokenHeaderName: { type: "string" },
		tokenQueryStringName: { type: "string" },
		audience: { type: "string" },
		issuer: { type: "string" },
		clockTolerance: { type: "string" },
		maxTokenAge: { type: "string" },
		payloadKey: { type: "string" },
		setToContext: { type: "boolean" },
	},
	additionalProperties: false,
};

export const httpPasetoValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const readCookieValue = (event, cookieName) => {
	const headers = event?.headers;
	const cookieHeader = headers?.cookie ?? headers?.Cookie;
	if (!cookieHeader) return undefined;
	const match = cookieHeader
		.split(";")
		.find((c) => c.trim().startsWith(`${cookieName}=`));
	if (!match) return undefined;
	let value = match.trim().slice(cookieName.length + 1);
	// RFC 6265 quoted-string cookie value
	// Stryker disable next-line EqualityOperator,ConditionalExpression: the length guard only differs from `>2`/`true` for values shorter than 2 chars (or exactly 2, i.e. `""`), none of which are valid PASETO tokens, so the strip decision is observably identical.
	if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
		value = value.slice(1, -1);
	}
	return value;
};

// RFC 6750 `Bearer` and RFC 9449 `DPoP`. Both carry the token in the same
// position; they differ only in what else the request must prove.
const AUTH_SCHEMES = new Set(["bearer", "dpop"]);

const readHeaderValue = (event, headerName) => {
	const headers = event?.headers;
	if (!headers) return undefined;
	const lowerName = headerName.toLowerCase();
	const rawValue = headers[headerName] ?? headers[lowerName];
	// Proxies (ALB multiValueHeaders, repeated headers) can deliver arrays.
	const raw = Array.isArray(rawValue) ? rawValue[0] : rawValue;
	if (!raw) return undefined;
	// Authorization header carries the `Bearer <token>` scheme; strip it.
	if (lowerName === "authorization") {
		const parts = raw.split(" ");
		if (parts.length !== 2 || !AUTH_SCHEMES.has(parts[0].toLowerCase())) {
			return undefined;
		}
		return parts[1];
	}
	return raw;
};

const readQueryValue = (event, paramName) => {
	const value = event?.queryStringParameters?.[paramName];
	return value || undefined;
};

const httpPasetoMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	if (options.internalKey === undefined) {
		throw new TypeError("No key source configured: set internalKey", {
			cause: { package: pkg },
		});
	}

	const cookieName = options.tokenCookieName;
	const headerName = options.tokenHeaderName;
	const queryStringName = options.tokenQueryStringName;

	const sources = [];
	if (cookieName) sources.push((e) => readCookieValue(e, cookieName));
	if (headerName) {
		sources.push((e) => readHeaderValue(e, headerName));
	}
	if (queryStringName) sources.push((e) => readQueryValue(e, queryStringName));
	if (sources.length === 0) {
		sources.push((e) => readHeaderValue(e, "Authorization"));
	}

	const parseToken = (event) => {
		for (const source of sources) {
			const token = source(event);
			if (token) return token;
		}
		throw new HttpError(401, {
			cause: {
				package: pkg,
				data: { reason: "No token found in configured sources" },
			},
		});
	};

	const baseVerifyOptions = {
		audience: options.audience,
		issuer: options.issuer,
		clockTolerance: options.clockTolerance,
		maxTokenAge: options.maxTokenAge,
	};

	// Per-middleware-instance cache of imported KeyObjects, keyed by the
	// keyData reference. createPublicKey reparses DER through OpenSSL on
	// every call (~tens of μs); since the resolved key is stable across
	// warm invocations, cache it. WeakMap keys must be objects — string
	// keyData (rare) falls through to the slow path each time.
	const keyCache = new WeakMap();

	const httpPasetoMiddlewareBefore = async (request) => {
		const token = parseToken(request.event);

		if (!token.startsWith("v4.public.")) {
			throw new HttpError(401, {
				cause: {
					package: pkg,
					data: { reason: "Unsupported PASETO version or purpose" },
				},
			});
		}

		const result = await getInternal(options.internalKey, request);
		const keyData = result[sanitizeKey(options.internalKey)];

		if (keyData === undefined) {
			throw new HttpError(500, {
				cause: {
					package: pkg,
					data: {
						reason: `internalKey '${options.internalKey}' resolved to undefined`,
					},
				},
			});
		}

		// WeakMap.get on a primitive returns `undefined` (only `set` throws),
		// so a single lookup works for all keyData shapes; cache writes happen
		// only for object-shaped keys. `createPublicKey` accepts Uint8Array /
		// Buffer directly — no copy needed.
		let key = keyCache.get(keyData);
		// Stryker disable next-line ConditionalExpression: forcing this `true` only bypasses the warm-cache reuse (re-importing an identical KeyObject); the verified payload is byte-identical, so the optimization is unobservable through the public interface.
		if (key === undefined) {
			const bytes =
				keyData?.publicKey instanceof Uint8Array ? keyData.publicKey : keyData;
			key = createPublicKey({ key: bytes, format: "der", type: "spki" });
			keyCache.set(keyData, key);
		}

		try {
			const payload = await V4.verify(token, key, baseVerifyOptions);
			request.internal[options.payloadKey] = payload;
			if (options.setToContext) {
				request.context[options.payloadKey] = payload;
			}
		} catch (e) {
			throw new HttpError(401, {
				cause: { package: pkg, data: { reason: e.message } },
			});
		}
	};

	return {
		before: httpPasetoMiddlewareBefore,
	};
};

export default httpPasetoMiddleware;
