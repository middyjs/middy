// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createPublicKey } from "node:crypto";
import { createError, getInternal, validateOptions } from "@middy/util";
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from "jose";

const name = "http-jwt";
const pkg = `@middy/${name}`;

// AWS KMS asymmetric keySpecs and the JWS algorithms each can produce.
// Used to validate the user's `algorithm` option against the keySpec carried
// alongside the public key on `request.internal` (typically populated by
// `@middy/kms`). A mismatch points to a misconfiguration — the configured
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
	internalKey: undefined,
	issuers: undefined,
	tokenCookieName: undefined,
	tokenHeaderName: undefined,
	tokenQueryStringName: undefined,
	algorithm: undefined,
	audience: undefined,
	issuer: undefined,
	clockTolerance: 0,
	payloadKey: "jwt",
	setToContext: false,
	cacheExpiry: undefined,
	cooldownDuration: undefined,
	disablePrefetch: false,
};

const stringOrStringArraySchema = {
	oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
};

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
					audience: stringOrStringArraySchema,
					algorithm: stringOrStringArraySchema,
				},
				required: ["jwksUri"],
				additionalProperties: false,
			},
		},
		tokenCookieName: { type: "string" },
		tokenHeaderName: { type: "string" },
		tokenQueryStringName: { type: "string" },
		algorithm: stringOrStringArraySchema,
		audience: stringOrStringArraySchema,
		issuer: stringOrStringArraySchema,
		clockTolerance: { type: "number", minimum: 0 },
		payloadKey: { type: "string" },
		setToContext: { type: "boolean" },
		cacheExpiry: { type: "number", minimum: 0 },
		cooldownDuration: { type: "number", minimum: 0 },
		disablePrefetch: { type: "boolean" },
	},
	additionalProperties: false,
};

export const httpJwtValidateOptions = (options) =>
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
	if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
		value = value.slice(1, -1);
	}
	return value;
};

const readHeaderValue = (event, headerName) => {
	const headers = event?.headers;
	if (!headers) return undefined;
	const lowerName = headerName.toLowerCase();
	const rawValue = headers[headerName] ?? headers[lowerName];
	// Proxies (ALB multiValueHeaders, repeated headers) can deliver arrays.
	const raw = Array.isArray(rawValue) ? rawValue[0] : rawValue;
	if (!raw) return undefined;
	// Authorization header carries the `Bearer <token>` scheme; strip it.
	// Any other scheme means the token isn't here, fall through.
	if (lowerName === "authorization") {
		const parts = raw.split(" ");
		if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
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

// Minimal JWKS resolver. Owns its own cache so we can read the raw JWK
// (including `alg`) before converting to a key.
const createJwksResolver = (uri, options = {}) => {
	const cacheMaxAge = options.cacheMaxAge ?? 600_000;
	const cooldownDuration = options.cooldownDuration ?? 30_000;
	let cache = null;
	let cacheTime = 0;
	let lastFetchTime = Number.NEGATIVE_INFINITY;
	let inflight = null;

	const fetchJwks = () => {
		if (inflight) return inflight;
		const now = Date.now();
		if (cache && now - lastFetchTime < cooldownDuration) {
			return Promise.resolve(cache);
		}
		lastFetchTime = now;
		inflight = (async () => {
			try {
				const res = await fetch(uri);
				if (!res.ok) {
					throw new Error(`JWKS fetch failed: HTTP ${res.status}`);
				}
				const doc = await res.json();
				if (!doc || !Array.isArray(doc.keys)) {
					throw new Error("Invalid JWKS document: missing keys array");
				}
				cache = doc;
				cacheTime = Date.now();
				return doc;
			} finally {
				inflight = null;
			}
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
			let jwk = doc.keys.find((k) => k.kid === kid);
			if (!jwk) {
				// Possible key rotation. Refetch subject to cooldown.
				doc = await fetchJwks();
				jwk = doc.keys.find((k) => k.kid === kid);
			}
			return jwk;
		},
	};
};

const httpJwtMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

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
			const resolver = createJwksResolver(entry.jwksUri, {
				cacheMaxAge: options.cacheExpiry,
				cooldownDuration: options.cooldownDuration,
			});
			issuersMap.set(iss, {
				resolver,
				audience: entry.audience,
				algorithms: entryAlgs,
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
		throw createError(401, "Unauthorized", {
			cause: { package: pkg, data: "No token found in configured sources" },
		});
	};

	const baseVerifyOptions = {};
	if (options.audience !== undefined)
		baseVerifyOptions.audience = options.audience;
	if (options.issuer !== undefined) baseVerifyOptions.issuer = options.issuer;
	if (options.clockTolerance)
		baseVerifyOptions.clockTolerance = options.clockTolerance;

	const httpJwtMiddlewareBefore = async (request) => {
		const token = parseToken(request.event);

		let key;
		let verifyOptions = baseVerifyOptions;

		if (issuersMap) {
			let header;
			let payload;
			try {
				header = decodeProtectedHeader(token);
				payload = decodeJwt(token);
			} catch (e) {
				throw createError(401, "Unauthorized", {
					cause: { package: pkg, data: `Malformed token: ${e.message}` },
				});
			}
			const entry = issuersMap.get(payload.iss);
			if (!entry) {
				throw createError(401, "Unauthorized", {
					cause: { package: pkg, data: "Unknown issuer" },
				});
			}
			let jwk;
			try {
				jwk = await entry.resolver.getJwk(header.kid);
			} catch (e) {
				throw createError(401, "Unauthorized", {
					cause: { package: pkg, data: `JWKS fetch failed: ${e.message}` },
				});
			}
			if (!jwk) {
				throw createError(401, "Unauthorized", {
					cause: {
						package: pkg,
						data: `No key in JWKS with kid '${header.kid}'`,
					},
				});
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
					throw createError(401, "Unauthorized", {
						cause: {
							package: pkg,
							data: `JWK alg '${jwk.alg}' not in configured allowlist`,
						},
					});
				}
				alg = jwk.alg;
			} else if (entry.algorithms.length === 1) {
				alg = entry.algorithms[0];
			} else {
				throw createError(401, "Unauthorized", {
					cause: {
						package: pkg,
						data: "JWK omits 'alg' and multiple algorithms configured; cannot disambiguate",
					},
				});
			}
			try {
				key = await importJWK(jwk, alg);
			} catch (e) {
				throw createError(401, "Unauthorized", {
					cause: {
						package: pkg,
						data: `JWK import failed: ${e.message}`,
					},
				});
			}
			verifyOptions = {
				issuer: payload.iss,
				algorithms: [alg],
			};
			if (entry.audience !== undefined) verifyOptions.audience = entry.audience;
			if (options.clockTolerance)
				verifyOptions.clockTolerance = options.clockTolerance;
		} else {
			const result = await getInternal(options.internalKey, request);
			const keyData = result[options.internalKey];
			if (keyData === undefined) {
				throw createError(500, "Internal Server Error", {
					cause: {
						package: pkg,
						data: `internalKey '${options.internalKey}' resolved to undefined`,
					},
				});
			}
			// algorithm is required at factory time when internalKey is set, so
			// topLevelAlgs is guaranteed non-empty here.
			let usableAlgs = topLevelAlgs;
			if (keyData?.publicKey instanceof Uint8Array) {
				// KMS shape: validate configured algorithm against keySpec. When
				// the keySpec is known, narrow the verify allowlist to the
				// intersection; if no overlap, fail closed (misconfiguration).
				// When keySpec is absent or unknown, trust the user's config.
				const compatible = KMS_COMPATIBLE_ALGS[keyData.keySpec];
				if (compatible) {
					usableAlgs = topLevelAlgs.filter((a) => compatible.includes(a));
					if (usableAlgs.length === 0) {
						throw createError(500, "Internal Server Error", {
							cause: {
								package: pkg,
								data: `algorithm ${JSON.stringify(topLevelAlgs)} incompatible with KMS keySpec '${keyData.keySpec}'`,
							},
						});
					}
				}
				key = createPublicKey({
					key: Buffer.from(keyData.publicKey),
					format: "der",
					type: "spki",
				});
			} else if (keyData instanceof Uint8Array) {
				key = createPublicKey({
					key: Buffer.from(keyData),
					format: "der",
					type: "spki",
				});
			} else {
				key = Buffer.from(keyData);
			}
			verifyOptions = { ...baseVerifyOptions, algorithms: usableAlgs };
		}

		try {
			const { payload } = await jwtVerify(token, key, verifyOptions);
			request.internal[options.payloadKey] = payload;
			if (options.setToContext) {
				request.context[options.payloadKey] = payload;
			}
		} catch (e) {
			throw createError(401, "Unauthorized", {
				cause: { package: pkg, data: e.message },
			});
		}
	};

	return {
		before: httpJwtMiddlewareBefore,
	};
};

export default httpJwtMiddleware;
