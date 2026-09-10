// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { KeyObject } from "node:crypto";
import {
	getInternal,
	HttpError,
	sanitizeKey,
	setContextNamespace,
	validateOptions,
} from "@middy/util";
import { PublicProtocol } from "paseto";
import { PublicKeyFromCryptoKey, VerifyFactory } from "paseto/v4/public";

// Verify is the only capability this middleware needs; the rest of v4.public
// (signing, key generation, PASERK) tree-shakes away.
const v4 = new PublicProtocol(VerifyFactory);

const name = "http-paseto";
const pkg = `@middy/${name}`;

const defaults = {
	// May resolve to one key or to an array of them. An array is a key rotation overlap:
	// an asymmetric key cannot be rotated in place, so rotating means standing up a second
	// key and accepting both until the last token signed by the retiring one has expired.
	internalKey: undefined,
	tokenCookieName: undefined,
	tokenHeaderName: undefined,
	tokenQueryStringName: undefined,
	audience: undefined,
	issuer: undefined,
	clockTolerance: undefined,
	maxTokenAge: undefined,
	expectedClaims: undefined,
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
		// Seconds. paseto v4 dropped the `ms`-style strings v3 accepted, and
		// requires a finite non-negative number. `maximum` is the finite bound,
		// not a policy ceiling: ajv rejects NaN under `type: "number"` but lets
		// Infinity through, which paseto then refuses at verify time as a 500.
		clockTolerance: {
			type: "number",
			minimum: 0,
			maximum: Number.MAX_SAFE_INTEGER,
		},
		maxTokenAge: {
			type: "number",
			minimum: 0,
			maximum: Number.MAX_SAFE_INTEGER,
		},
		// Values are compared with strict equality, so an array or an object could
		// only ever match itself by reference. Refuse them here rather than 401 every
		// request with a message reading `is 'a,b', expected 'a,b'`.
		expectedClaims: {
			type: "object",
			additionalProperties: {
				oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
			},
		},
		payloadKey: { type: "string" },
		setToContext: { type: "boolean" },
	},
	additionalProperties: false,
};

export const httpPasetoValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const keyError = (reason) =>
	new HttpError(500, { cause: { package: pkg, data: { reason } } });

// One entry of `internalKey` -> a paseto PublicKey. Three shapes are accepted:
//   - `{ publicKey: Uint8Array }`, what @middy/kms returns
//   - a Uint8Array / Buffer of DER SPKI bytes
//   - a KeyObject, for a caller that resolved its own key, e.g. from a PEM in the
//     environment. A KMS asymmetric key never rotates in place, so its public half is
//     immutable and there is nothing to refetch, which makes a plain env var a
//     reasonable place to keep it. paseto v4 keys are WebCrypto-backed, so a
//     KeyObject is re-exported to SPKI and re-imported through `crypto.subtle`.
const importKey = async (entry) => {
	const bytes =
		entry instanceof KeyObject
			? entry.export({ type: "spki", format: "der" })
			: entry?.publicKey instanceof Uint8Array
				? entry.publicKey
				: entry;
	if (!(bytes instanceof Uint8Array)) {
		// Both `crypto.subtle.importKey` and `KeyObject#export` throw bare errors on
		// anything else, which escape as an unlabelled 500. Name the problem instead.
		throw keyError(
			"internalKey holds an unsupported key shape; expected a KeyObject, SPKI DER bytes, or a { publicKey } object",
		);
	}
	let cryptoKey;
	try {
		cryptoKey = await crypto.subtle.importKey("spki", bytes, "Ed25519", false, [
			"verify",
		]);
	} catch (e) {
		// A well-formed SPKI for the wrong algorithm (RSA, P-256, ...) lands here. It
		// is a deployment mistake, not a bad request, so it stays a 500.
		throw keyError(
			`internalKey is not an Ed25519 verification key: ${e.message}`,
		);
	}
	return PublicKeyFromCryptoKey(cryptoKey);
};

// HTTP API payload 2.0 strips the Cookie header and delivers each cookie as a
// `name=value` entry of `event.cookies`. The header is searched first, so an
// event that somehow carries both keeps its header semantics.
const readCookieValue = (event, cookieName) => {
	const headers = event?.headers;
	const cookieHeader = headers?.cookie ?? headers?.Cookie;
	// Stryker disable next-line ArrayDeclaration: equivalent. The list is only ever searched for a `name=` prefix, and a seeded fallback entry carries no `=`, so it can never be the match.
	const candidates = cookieHeader ? cookieHeader.split(";") : [];
	if (Array.isArray(event?.cookies)) {
		for (const cookie of event.cookies) {
			if (typeof cookie === "string") candidates.push(cookie);
		}
	}
	const match = candidates.find((c) => c.trim().startsWith(`${cookieName}=`));
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

	const expectedClaims = Object.entries(options.expectedClaims ?? {});

	// Per-middleware-instance cache of imported keys, keyed by the keyData
	// reference. crypto.subtle.importKey reparses the DER on every call;
	// since the resolved key is stable across warm invocations, cache it.
	// WeakMap keys must be objects, string keyData (rare) falls through to
	// the slow path each time.
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
		// only for object-shaped keys. `crypto.subtle.importKey` accepts
		// Uint8Array / Buffer directly, no copy needed.
		let keys = keyCache.get(keyData);
		// Stryker disable next-line ConditionalExpression: forcing this `true` only bypasses the warm-cache reuse (re-importing an identical key); the verified claims are byte-identical, so the optimization is unobservable through the public interface.
		if (keys === undefined) {
			keys = await Promise.all(
				(Array.isArray(keyData) ? keyData : [keyData]).map(importKey),
			);
			// Stryker disable next-line CallExpression: same warm-cache optimization as the guard above. Dropping the write only means the next invocation re-imports an identical key, which verifies to byte-identical claims.
			keyCache.set(keyData, keys);
		}

		// An empty array is a misconfiguration, not a rejection: with no key to try,
		// the loop below would fall through and every token would fail for a reason
		// nobody could act on. Same 500 as an unresolved internalKey.
		if (keys.length === 0) {
			throw new HttpError(500, {
				cause: {
					package: pkg,
					data: {
						reason: `internalKey '${options.internalKey}' resolved to no keys`,
					},
				},
			});
		}

		// Tried in order, first success wins. With one key this is the same single
		// verify it always was; the loop exists for a rotation overlap, where two
		// keys are genuinely current at once.
		let payload;
		let failure;
		for (const key of keys) {
			try {
				({ claims: payload } = await v4.Verify(key, token, baseVerifyOptions));
				break;
			} catch (e) {
				// A key that is not the signer fails on the signature and says nothing
				// about the request. Only the signing key can report why a correctly
				// signed token was still refused, so its failure outranks a signature
				// miss from any position in the array.
				if (
					failure === undefined ||
					failure.code === "ERR_PASETO_INVALID_TOKEN"
				) {
					failure = e;
				}
			}
		}
		if (payload === undefined) {
			throw new HttpError(401, {
				cause: { package: pkg, data: { reason: failure.message } },
			});
		}

		// Claims the caller declared mandatory, compared with strict equality and
		// checked before the payload is published, so nothing downstream can read a
		// payload this rejected.
		for (const [claim, expected] of expectedClaims) {
			if (payload[claim] !== expected) {
				throw new HttpError(401, {
					cause: {
						package: pkg,
						data: {
							reason: `Claim '${claim}' is '${payload[claim]}', expected '${expected}'`,
						},
					},
				});
			}
		}

		request.internal[options.payloadKey] = payload;
		if (options.setToContext) {
			setContextNamespace(request, options.payloadKey, payload);
		}
	};

	return {
		before: httpPasetoMiddlewareBefore,
	};
};

export default httpPasetoMiddleware;
