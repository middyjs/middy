// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createPublicKey, KeyObject } from "node:crypto";
import {
	getInternal,
	HttpError,
	sanitizeKey,
	setContextNamespace,
	validateOptions,
} from "@middy/util";
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from "jose";

const name = "http-jwt";
const pkg = `@middy/${name}`;

// AWS KMS asymmetric keySpecs and the JWS algorithms each can produce.
// Used to validate the user's `algorithm` option against the keySpec carried
// alongside the public key on `request.internal` (typically populated by
// `@middy/kms`). A mismatch points to a misconfiguration, the configured
// algorithm cannot actually sign or verify with this key shape.
const KMS_COMPATIBLE_ALGS = {
	RSA_2048: ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512"],
	RSA_3072: ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512"],
	RSA_4096: ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512"],
	ECC_NIST_P256: ["ES256"],
	ECC_NIST_P384: ["ES384"],
	ECC_NIST_P521: ["ES512"],
	ECC_NIST_ED25519: ["EdDSA"],
};

const defaults = {
	// May resolve to one key or to an array of them. An array is a key rotation overlap,
	// for a deployment whose keys are static rather than served from a JWKS: an asymmetric
	// key cannot be rotated in place, so rotating means standing up a second key and
	// accepting both until the last token signed by the retiring one has expired. The
	// `issuers` path needs none of this; a JWKS already rotates by `kid`.
	internalKey: undefined,
	issuers: undefined,
	tokenCookieName: undefined,
	tokenHeaderName: undefined,
	tokenQueryStringName: undefined,
	algorithm: undefined,
	audience: undefined,
	issuer: undefined,
	// Expected JWS `typ` header. RFC 9068 section 4: a resource server MUST
	// check that a JWT access token has typ "at+jwt". Pinning it stops a token
	// of another type from the same issuer and key (an OIDC ID token, typ "JWT")
	// passing as an access token (RFC 8725 section 3.11).
	typ: "at+jwt",
	clockTolerance: 0,
	// RFC 9068 section 2.2: exp is REQUIRED in a JWT access token. jose only
	// checks exp when present, so without this an exp-less token never expires.
	requireExp: true,
	expectedClaims: undefined,
	maxTokenAge: undefined,
	payloadKey: "jwt",
	// Defaults to `${payloadKey}Token`.
	tokenKey: undefined,
	setToContext: false,
	cacheExpiry: undefined,
	cooldownDuration: undefined,
	jwksTimeoutMs: 5000,
	disablePrefetch: false,
};

const stringOrStringArraySchema = {
	oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
};

// `null` disables the aud check.
const nullableStringOrStringArraySchema = {
	oneOf: [...stringOrStringArraySchema.oneOf, { const: null }],
};

// `null` disables the typ check.
const typSchema = { oneOf: [{ type: "string" }, { const: null }] };

const optionSchema = {
	type: "object",
	properties: {
		internalKey: { type: "string" },
		issuers: {
			type: "object",
			additionalProperties: {
				type: "object",
				properties: {
					jwksUri: { type: "string" },
					audience: nullableStringOrStringArraySchema,
					algorithm: stringOrStringArraySchema,
					typ: typSchema,
				},
				required: ["jwksUri"],
				additionalProperties: false,
			},
		},
		tokenCookieName: { type: "string" },
		tokenHeaderName: { type: "string" },
		tokenQueryStringName: { type: "string" },
		algorithm: stringOrStringArraySchema,
		audience: nullableStringOrStringArraySchema,
		issuer: stringOrStringArraySchema,
		typ: typSchema,
		clockTolerance: {
			type: "number",
			minimum: 0,
			maximum: Number.MAX_SAFE_INTEGER,
		},
		requireExp: { type: "boolean" },
		// Values are compared with strict equality, so an array or an object could
		// only ever match itself by reference. Refuse them here rather than 401 every
		// request with a message reading `is 'a,b', expected 'a,b'`.
		expectedClaims: {
			type: "object",
			additionalProperties: {
				oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
			},
		},
		maxTokenAge: { oneOf: [{ type: "string" }, { type: "number" }] },
		payloadKey: { type: "string" },
		tokenKey: { type: "string" },
		setToContext: { type: "boolean" },
		cacheExpiry: {
			type: "number",
			minimum: 0,
			maximum: Number.MAX_SAFE_INTEGER,
		},
		cooldownDuration: {
			type: "number",
			minimum: 0,
			maximum: Number.MAX_SAFE_INTEGER,
		},
		jwksTimeoutMs: {
			type: "integer",
			minimum: 1,
			maximum: Number.MAX_SAFE_INTEGER,
		},
		disablePrefetch: { type: "boolean" },
	},
	additionalProperties: false,
};

export const httpJwtValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// ALB with multi-value headers enabled sends `multiValueHeaders` and no
// `headers`. Read it directly so this does not depend on http-event-normalizer
// running first.
// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers
const eventHeaders = (event) => event?.headers ?? event?.multiValueHeaders;

// HTTP API payload 2.0 strips the Cookie header and delivers each cookie as a
// `name=value` entry of `event.cookies`. The header is searched first, so an
// event that somehow carries both keeps its header semantics.
const readCookieValue = (event, cookieName) => {
	const headers = eventHeaders(event);
	const rawCookie = headers?.cookie ?? headers?.Cookie;
	const cookieHeader = Array.isArray(rawCookie)
		? rawCookie.join(";")
		: rawCookie;
	const prefix = `${cookieName}=`;
	const isMatch = (c) => typeof c === "string" && c.trim().startsWith(prefix);
	let match = cookieHeader ? cookieHeader.split(";").find(isMatch) : undefined;
	if (match === undefined && Array.isArray(event?.cookies)) {
		match = event.cookies.find(isMatch);
	}
	if (match === undefined) return undefined;
	let value = match.trim().slice(cookieName.length + 1);
	// RFC 6265 quoted-string cookie value
	if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
		value = value.slice(1, -1);
	}
	return value;
};

// RFC 6750 `Bearer` and RFC 9449 `DPoP`. Both carry the token in the same
// position; they differ only in what else the request must prove.
const AUTH_SCHEMES = new Set(["bearer", "dpop"]);

const readHeaderValue = (event, headerName) => {
	const headers = eventHeaders(event);
	if (!headers) return undefined;
	const lowerName = headerName.toLowerCase();
	const rawValue = headers[headerName] ?? headers[lowerName];
	// ALB multiValueHeaders and repeated headers deliver arrays.
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

const normalizeAlgs = (alg) => {
	if (alg === undefined) return undefined;
	return Array.isArray(alg) ? alg : [alg];
};

const assertValidAlgs = (algs, where) => {
	if (algs.length === 0) {
		throw new TypeError(`algorithm list is empty (${where})`, {
			cause: { package: pkg },
		});
	}
	for (const a of algs) {
		if (a === "none") {
			throw new TypeError(`algorithm 'none' is not allowed (${where})`, {
				cause: { package: pkg },
			});
		}
	}
};

// A JWKS is a handful of public keys. RFC 7517 puts no bound on the document,
// but 1 MiB is far beyond any real keyset and small enough that a wrong URI
// cannot buffer a download into an out-of-memory.
const MAX_JWKS_BYTES = 1_048_576;

// Counted as it streams so the cap holds without a Content-Length header, and
// so an oversized body is dropped as soon as it crosses the line.
const readJwksDocument = async (res) => {
	// A 2xx with no body (a 204, say) is not a keyset.
	if (!res.body) {
		throw new Error("JWKS response has no body");
	}
	const chunks = [];
	let total = 0;
	for await (const chunk of res.body) {
		total += chunk.byteLength;
		if (total > MAX_JWKS_BYTES) {
			throw new Error(`JWKS document exceeds ${MAX_JWKS_BYTES} bytes`);
		}
		chunks.push(chunk);
	}
	return JSON.parse(Buffer.concat(chunks, total).toString("utf8"));
};

// RFC 7517 §4.2 and §4.3: a key published for encryption, or whose permitted
// operations leave out `verify`, must not verify a signature however well its
// `kid` and `alg` line up.
const canVerify = (jwk) =>
	(jwk.use === undefined || jwk.use === "sig") &&
	(jwk.key_ops === undefined ||
		(Array.isArray(jwk.key_ops) && jwk.key_ops.includes("verify")));

const findJwk = (doc, kid) =>
	doc.keys.find((jwk) => jwk.kid === kid && canVerify(jwk));

// Minimal JWKS resolver. Owns its own cache so we can read the raw JWK
// (including `alg`) before converting to a key.
const createJwksResolver = (uri, options = {}) => {
	const cacheMaxAge = options.cacheMaxAge ?? 600_000;
	const cooldownDuration = options.cooldownDuration ?? 30_000;
	// `{ ...defaults, ...opts }` lets an explicit `jwksTimeoutMs: undefined`
	// through, and `AbortSignal.timeout(undefined)` throws on every fetch.
	const timeoutMs = options.timeoutMs ?? defaults.jwksTimeoutMs;
	let cache = null;
	let cacheTime = 0;
	let lastFetchTime = Number.NEGATIVE_INFINITY;
	let lastError = null;
	let inflight = null;

	const fetchJwks = () => {
		if (inflight) return inflight;
		const now = Date.now();
		if (now - lastFetchTime < cooldownDuration) {
			// The last fetch has settled (inflight is null), so exactly one of
			// these is set. With nothing cached, every request inside the cooldown
			// would otherwise pay the full fetch (up to timeoutMs) against an IdP
			// that just failed; it gets that failure at once instead.
			return cache ? Promise.resolve(cache) : Promise.reject(lastError);
		}
		lastFetchTime = now;
		inflight = (async () => {
			let doc;
			try {
				// Without a deadline a stalled IdP would hold every request that
				// misses the cache until Lambda itself times out.
				const res = await fetch(uri, {
					signal: AbortSignal.timeout(timeoutMs),
				});
				if (!res.ok) {
					throw new Error(`JWKS fetch failed: HTTP ${res.status}`);
				}
				doc = await readJwksDocument(res);
				if (!doc || !Array.isArray(doc.keys)) {
					throw new Error("Invalid JWKS document: missing keys array");
				}
				cache = doc;
				cacheTime = Date.now();
			} catch (e) {
				lastError = e;
				throw e;
			} finally {
				inflight = null;
			}
			return doc;
		})();
		return inflight;
	};

	return {
		warm: () => {
			fetchJwks().catch(() => {});
		},
		getJwk: async (kid) => {
			const now = Date.now();
			let doc = cache;
			if (!doc || now - cacheTime > cacheMaxAge) {
				doc = await fetchJwks();
			}
			let jwk = findJwk(doc, kid);
			if (!jwk) {
				// Possible key rotation. Refetch subject to cooldown.
				doc = await fetchJwks();
				jwk = findJwk(doc, kid);
			}
			return jwk;
		},
	};
};

// RFC 6750 §3: a 401 names the scheme it wants. §3.1: a request that presented
// no token gets the bare challenge, one whose token was refused gets
// `invalid_token`. `http-error-handler` copies `error.headers` onto the response.
const unauthorized = (reason, challenge = 'Bearer error="invalid_token"') => {
	const error = new HttpError(401, {
		cause: { package: pkg, data: { reason } },
	});
	error.headers = { "WWW-Authenticate": challenge };
	return error;
};

const httpJwtMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const tokenKey = options.tokenKey ?? `${options.payloadKey}Token`;

	const keySources = [options.internalKey, options.issuers].filter(
		(v) => v !== undefined,
	);
	if (keySources.length === 0) {
		throw new TypeError(
			"No key source configured: set internalKey or issuers",
			{ cause: { package: pkg } },
		);
	}
	if (keySources.length > 1) {
		throw new TypeError("Set exactly one of internalKey, issuers", {
			cause: { package: pkg },
		});
	}

	const topLevelAlgs = normalizeAlgs(options.algorithm);
	if (topLevelAlgs) assertValidAlgs(topLevelAlgs, "options.algorithm");

	// `algorithm` must be pinned at factory time for every key source. Without
	// it, jwtVerify would honor the token-declared `alg` and the verifier
	// would be vulnerable to alg-substitution attacks.
	if (options.internalKey !== undefined && !topLevelAlgs) {
		throw new TypeError("algorithm is required when using internalKey", {
			cause: { package: pkg },
		});
	}

	let issuersMap;
	if (options.issuers !== undefined) {
		if (!topLevelAlgs) {
			throw new TypeError("algorithm is required when using issuers", {
				cause: { package: pkg },
			});
		}
		issuersMap = new Map();
		for (const [iss, entry] of Object.entries(options.issuers)) {
			const entryAlgs = normalizeAlgs(entry.algorithm) ?? topLevelAlgs;
			assertValidAlgs(entryAlgs, `issuers['${iss}'].algorithm`);
			// RFC 9068 section 4: the resource server MUST check `aud`. A shared
			// issuer signs tokens for every client it serves, so with no audience
			// any of them would pass. `null` is the explicit opt-out, so only
			// `undefined` inherits, as with `typ`.
			const audience =
				entry.audience === undefined ? options.audience : entry.audience;
			if (audience === undefined) {
				throw new TypeError(
					`issuers['${iss}'].audience is required: set it, set the top-level audience, or set null to skip the aud check`,
					{ cause: { package: pkg } },
				);
			}
			const resolver = createJwksResolver(entry.jwksUri, {
				cacheMaxAge: options.cacheExpiry,
				cooldownDuration: options.cooldownDuration,
				timeoutMs: options.jwksTimeoutMs,
			});
			issuersMap.set(iss, {
				resolver,
				// jose skips the check only for `undefined`.
				audience: audience ?? undefined,
				algorithms: entryAlgs,
				// `null` on the issuer disables the check, so only `undefined` inherits.
				typ: (entry.typ === undefined ? options.typ : entry.typ) ?? undefined,
			});
		}
		if (!options.disablePrefetch) {
			for (const entry of issuersMap.values()) {
				entry.resolver.warm();
			}
		}
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
	// Default source: Authorization header with Bearer scheme.
	if (sources.length === 0) {
		sources.push((e) => readHeaderValue(e, "Authorization"));
	}

	const parseToken = (event) => {
		for (const source of sources) {
			const token = source(event);
			if (token) return token;
		}
		throw unauthorized("No token found in configured sources", "Bearer");
	};

	// jose skips a check only for `undefined`; `null` is the opt-out here.
	const baseVerifyOptions = {
		audience: options.audience ?? undefined,
		issuer: options.issuer,
		typ: options.typ ?? undefined,
		clockTolerance: options.clockTolerance,
		maxTokenAge: options.maxTokenAge,
	};
	if (options.requireExp) baseVerifyOptions.requiredClaims = ["exp"];

	// Distinct from jose's `requiredClaims` above, which lists claims that must be
	// PRESENT. These must be present AND equal to the given value.
	const expectedClaims = Object.entries(options.expectedClaims ?? {});

	// Cache imported keys per-middleware-instance. `importJWK` and
	// `createPublicKey` reparse via OpenSSL on every call (~tens of μs);
	// these results are stable across warm invocations.
	// Keyed by the JWK object the resolver returned, not by `kid`: a refetched
	// JWKS yields new objects, so a key rotated under the same `kid` is imported
	// afresh and the retired one stops verifying. Each issuer has its own
	// resolver and document, so two issuers publishing the same `kid` never share
	// an entry. Entries go when their document is dropped.
	const jwkKeyCache = new WeakMap(); // key: JWK object; value: Map alg -> imported key
	const publicKeyCache = new WeakMap(); // key: keyData ref; value: KeyObject

	// SPKI DER bytes, either bare or under the `publicKey` of the `@middy/kms` shape.
	const derToPublicKey = (entry) => {
		let key = publicKeyCache.get(entry);
		if (!key) {
			key = createPublicKey({
				key: Buffer.from(entry.publicKey ?? entry),
				format: "der",
				type: "spki",
			});
			publicKeyCache.set(entry, key);
		}
		return key;
	};

	const httpJwtMiddlewareBefore = async (request) => {
		const token = parseToken(request.event);

		// [{ key, verifyOptions }]. The JWKS path resolves exactly one, by `kid`.
		// The static path resolves one per configured key.
		let candidates;

		if (issuersMap) {
			let key;
			let header;
			let payload;
			try {
				header = decodeProtectedHeader(token);
				payload = decodeJwt(token);
			} catch (e) {
				throw unauthorized(`Malformed token: ${e.message}`);
			}
			const entry = issuersMap.get(payload.iss);
			if (!entry) {
				throw unauthorized("Unknown issuer");
			}
			let jwk;
			try {
				jwk = await entry.resolver.getJwk(header.kid);
			} catch (e) {
				// The token was not refused; it could not be checked. A 401 would
				// send the client off for a new token that the same outage would
				// reject again. The failure is upstream, so it is a gateway error:
				// 504 past the `jwksTimeoutMs` deadline (`AbortSignal.timeout`
				// rejects with a TimeoutError), 502 for everything else the
				// endpoint did wrong. The negative cache re-throws the recorded
				// error, so a remembered failure keeps its status. Exposed on purpose:
				// util defaults `expose` to false for a 5xx, and http-error-handler
				// would then swap the gateway status for its generic 500.
				throw new HttpError(e.name === "TimeoutError" ? 504 : 502, {
					expose: true,
					cause: { package: pkg, data: { reason: e.message } },
				});
			}
			if (!jwk) {
				throw unauthorized(`No key in JWKS with kid '${header.kid}'`);
			}
			// Hybrid algorithm resolution:
			//   1. If the JWK declares `alg`, it must be in the configured allowlist
			//      for this issuer. We use it as the single verify algorithm.
			//   2. If the JWK omits `alg` and the allowlist has exactly one entry,
			//      we use that entry.
			//   3. If the JWK omits `alg` and the allowlist has more than one entry,
			//      we reject as ambiguous: the IdP did not say which alg the key is
			//      for, and we refuse to guess.
			let alg;
			if (jwk.alg) {
				if (!entry.algorithms.includes(jwk.alg)) {
					throw unauthorized(
						`JWK alg '${jwk.alg}' not in configured allowlist`,
					);
				}
				alg = jwk.alg;
			} else if (entry.algorithms.length === 1) {
				alg = entry.algorithms[0];
			} else {
				throw unauthorized(
					"JWK omits 'alg' and multiple algorithms configured; cannot disambiguate",
				);
			}
			let keysByAlg = jwkKeyCache.get(jwk);
			if (!keysByAlg) {
				keysByAlg = new Map();
				jwkKeyCache.set(jwk, keysByAlg);
			}
			key = keysByAlg.get(alg);
			if (!key) {
				try {
					key = await importJWK(jwk, alg);
				} catch (e) {
					throw unauthorized(`JWK import failed: ${e.message}`);
				}
				keysByAlg.set(alg, key);
			}
			const verifyOptions = {
				issuer: payload.iss,
				algorithms: [alg],
				audience: entry.audience,
				typ: entry.typ,
				clockTolerance: options.clockTolerance,
				maxTokenAge: options.maxTokenAge,
			};
			if (options.requireExp) verifyOptions.requiredClaims = ["exp"];
			candidates = [{ key, verifyOptions }];
		} else {
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

			// One key, or several during a rotation overlap. Each resolves on its own,
			// because a KMS keySpec narrows the algorithm list per key rather than for
			// the middleware as a whole.
			const entries = Array.isArray(keyData) ? keyData : [keyData];
			if (entries.length === 0) {
				throw new HttpError(500, {
					cause: {
						package: pkg,
						data: {
							reason: `internalKey '${options.internalKey}' resolved to no keys`,
						},
					},
				});
			}

			candidates = entries.map((entry) => {
				// algorithm is required at factory time when internalKey is set, so
				// topLevelAlgs is guaranteed non-empty here.
				let usableAlgs = topLevelAlgs;
				let entryKey;
				if (entry instanceof KeyObject || entry instanceof CryptoKey) {
					// Already resolved by the caller: `createPublicKey` on a PEM held in
					// the environment gives a KeyObject, jose's own `importSPKI` /
					// `importJWK` / `generateKeyPair` give a CryptoKey, and `jwtVerify`
					// takes either. Nothing here knows the key's provenance, so the
					// configured algorithm is trusted exactly as it is for raw DER; jose
					// refuses the pair if the key cannot carry that algorithm.
					entryKey = entry;
				} else if (entry?.publicKey instanceof Uint8Array) {
					// KMS shape: validate configured algorithm against keySpec. When
					// the keySpec is known, narrow the verify allowlist to the
					// intersection; if no overlap, fail closed (misconfiguration).
					// When keySpec is absent or unknown, trust the user's config.
					const compatible = KMS_COMPATIBLE_ALGS[entry.keySpec];
					if (compatible) {
						usableAlgs = topLevelAlgs.filter((a) => compatible.includes(a));
						if (usableAlgs.length === 0) {
							throw new HttpError(500, {
								cause: {
									package: pkg,
									data: {
										reason: `algorithm ${JSON.stringify(topLevelAlgs)} incompatible with KMS keySpec '${entry.keySpec}'`,
									},
								},
							});
						}
					}
					entryKey = derToPublicKey(entry);
				} else if (entry instanceof Uint8Array) {
					entryKey = derToPublicKey(entry);
				} else if (typeof entry === "string") {
					if (usableAlgs.some((a) => !a.startsWith("HS"))) {
						throw new HttpError(500, {
							cause: {
								package: pkg,
								data: {
									reason: `internalKey '${options.internalKey}' is a string secret but 'algorithm' includes a non-symmetric value ${JSON.stringify(usableAlgs)}; string keys may only be used with HS* algorithms`,
								},
							},
						});
					}
					entryKey = Buffer.from(entry);
				} else {
					// Anything else has to say what it really is. Borrowing the string
					// secret's message sent people looking at their `algorithm` option
					// when the key was the problem.
					throw new HttpError(500, {
						cause: {
							package: pkg,
							data: {
								reason: `internalKey '${options.internalKey}' holds an unsupported key shape; expected a KeyObject, a CryptoKey, SPKI DER bytes, a { publicKey } object, or a string secret`,
							},
						},
					});
				}
				return {
					key: entryKey,
					verifyOptions: { ...baseVerifyOptions, algorithms: usableAlgs },
				};
			});
		}

		// Tried in order, first success wins. With one candidate this is the same
		// single verify it always was; the loop exists for a rotation overlap.
		let verified;
		let failure;
		for (const candidate of candidates) {
			try {
				({ payload: verified } = await jwtVerify(
					token,
					candidate.key,
					candidate.verifyOptions,
				));
				break;
			} catch (e) {
				// A key that is not the signer fails on the signature and says nothing
				// about the request. Only the signing key can report why a correctly
				// signed token was still refused, so its failure outranks a signature
				// miss from any position in the array.
				if (
					failure === undefined ||
					failure.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED"
				) {
					failure = e;
				}
			}
		}
		if (verified === undefined) {
			throw unauthorized(failure.message);
		}

		// Claims the caller declared mandatory, compared with strict equality and
		// checked before the payload is published, so nothing downstream can read a
		// payload this rejected.
		for (const [claim, expected] of expectedClaims) {
			if (verified[claim] !== expected) {
				throw unauthorized(
					`Claim '${claim}' is '${verified[claim]}', expected '${expected}'`,
				);
			}
		}

		// The token exactly as verified, so @middy/http-dpop can hash the one
		// that was checked (RFC 9449 §4.3) whichever source it came from.
		request.internal[tokenKey] = token;
		request.internal[options.payloadKey] = verified;
		if (options.setToContext) {
			setContextNamespace(request, options.payloadKey, verified);
		}
	};

	return {
		before: httpJwtMiddlewareBefore,
	};
};

export default httpJwtMiddleware;
