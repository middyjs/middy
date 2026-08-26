// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { constants, createHash, createPublicKey, verify } from "node:crypto";
import {
	getInternal,
	HttpError,
	sanitizeKey,
	validateOptions,
} from "@middy/util";

const name = "http-dpop";
const pkg = `@middy/${name}`;

const defaults = {
	payloadKey: "jwt",
	proofKey: "dpop",
	confirmationClaim: "cnf",
	origin: undefined,
	algorithm: undefined,
	maxAge: 60,
	maxProofLength: 8192,
	required: false,
	setToContext: false,
};

const stringOrStringArraySchema = {
	oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
};

const optionSchema = {
	type: "object",
	properties: {
		payloadKey: { type: "string" },
		proofKey: { type: "string" },
		confirmationClaim: { type: "string" },
		origin: { type: "string" },
		algorithm: stringOrStringArraySchema,
		maxAge: { type: "number", minimum: 0 },
		maxProofLength: { type: "number", minimum: 1 },
		required: { type: "boolean" },
		setToContext: { type: "boolean" },
	},
	additionalProperties: false,
};

export const httpDpopValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const ALGORITHMS = {
	ES256: {
		kty: "EC",
		crv: "P-256",
		hash: "SHA256",
		options: { dsaEncoding: "ieee-p1363" },
	},
	ES384: {
		kty: "EC",
		crv: "P-384",
		hash: "SHA384",
		options: { dsaEncoding: "ieee-p1363" },
	},
	ES512: {
		kty: "EC",
		crv: "P-521",
		hash: "SHA512",
		options: { dsaEncoding: "ieee-p1363" },
	},
	PS256: {
		kty: "RSA",
		hash: "SHA256",
		options: {
			padding: constants.RSA_PKCS1_PSS_PADDING,
			saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
		},
	},
	RS256: { kty: "RSA", hash: "SHA256", options: {} },
	EdDSA: { kty: "OKP", crv: "Ed25519", hash: null, options: {} },
};

const ALGORITHM_NAMES = Object.keys(ALGORITHMS);

// RFC 7638 §3.2: only the required members, in lexicographic order, with no
// whitespace. Hashing only these means an extra member in the JWK cannot change
// which key the thumbprint names.
const THUMBPRINT_MEMBERS = {
	EC: ["crv", "kty", "x", "y"],
	OKP: ["crv", "kty", "x"],
	RSA: ["e", "kty", "n"],
};

// Anything that would make a JWK a private key. RFC 9449 §4.2 requires the
// `jwk` header to carry the public key only.
const PRIVATE_MEMBERS = ["d", "p", "q", "dp", "dq", "qi", "k"];

export const jwkThumbprint = (jwk) => {
	const members = THUMBPRINT_MEMBERS[jwk?.kty];
	if (!members) {
		throw new Error(`Unsupported JWK key type '${jwk?.kty}'`, {
			cause: { package: pkg, data: { kty: jwk?.kty } },
		});
	}
	const canonical = {};
	for (const member of members) {
		if (typeof jwk[member] !== "string") {
			throw new Error(`JWK is missing required member '${member}'`, {
				cause: { package: pkg, data: { member } },
			});
		}
		canonical[member] = jwk[member];
	}
	return createHash("sha256")
		.update(JSON.stringify(canonical))
		.digest("base64url");
};

// RFC 9449 §4.2: `ath` is the base64url SHA-256 of the access token as it was
// presented, not of any decoded form of it.
export const accessTokenHash = (token) =>
	createHash("sha256").update(token).digest("base64url");

// Every input here is attacker-supplied, so each decode returns a plain object
// or throws a plain Error. A TypeError or RangeError escaping this module would
// mean an unhandled crash rather than a 401.
const decodeJson = (segment, label) => {
	let value;
	try {
		value = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
	} catch {
		throw new Error(`Proof ${label} is not JSON`);
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Proof ${label} is not an object`);
	}
	return value;
};

// RFC 9449 §4.3 compares the `htu` with query and fragment removed, so a client
// never has to reproduce the server's query serialization.
const httpUri = (url, label) => {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error(`${label} is not a URL`);
	}
	return `${parsed.origin}${parsed.pathname}`;
};

const normalizeAlgorithms = (algorithm) => {
	if (algorithm === undefined) return ALGORITHM_NAMES;
	const list = Array.isArray(algorithm) ? algorithm : [algorithm];
	for (const alg of list) {
		if (!ALGORITHMS[alg]) {
			throw new TypeError(
				`Unsupported algorithm '${alg}', expected one of ${ALGORITHM_NAMES.join(", ")}`,
				{ cause: { package: pkg } },
			);
		}
	}
	return list;
};

// Every reader below returns a string or undefined. The event is Lambda's, but
// its shape is not guaranteed, so nothing here assumes a type it did not check.
const asString = (value) => (typeof value === "string" ? value : undefined);

// Covers API Gateway HTTP (v2), API Gateway REST (v1) and ALB.
const readMethod = (event) =>
	asString(event?.requestContext?.http?.method) ?? asString(event?.httpMethod);

const readPath = (event) => asString(event?.rawPath) ?? asString(event?.path);

// Never the Host header: a client controls it, so trusting it would let a proof
// be minted for any origin the attacker chose. `requestContext.domainName` is
// set by API Gateway from the domain that actually served the request, which is
// why it is a safe fallback. Behind a CDN or any other proxy, set `origin`.
const readOrigin = (event, configured) => {
	if (configured) return configured;
	const domainName = asString(event?.requestContext?.domainName);
	return domainName ? `https://${domainName}` : undefined;
};

// Exactly one DPoP header, per RFC 9449 §4.3 step 1. Proxies can deliver a
// repeated header as an array, and two proofs is ambiguous rather than merely
// redundant, so it is refused instead of resolved.
const readProof = (headers) => {
	const raw = headers?.dpop ?? headers?.DPoP ?? headers?.Dpop;
	if (Array.isArray(raw)) {
		return raw.length === 1 ? asString(raw[0]) : undefined;
	}
	return asString(raw);
};

const readAuthorization = (headers) => {
	const raw = headers?.authorization ?? headers?.Authorization;
	return asString(Array.isArray(raw) ? raw[0] : raw);
};

/**
 * Verify a DPoP proof JWT and return the JWK thumbprint of the key that signed
 * it. Throws on every failure. Exported so it can be reused outside a middy
 * handler; inside one, prefer the middleware.
 */
export const verifyDpopProof = (
	proof,
	{ method, url, accessToken, algorithms = ALGORITHM_NAMES, maxAge = 60 } = {},
) => {
	if (typeof proof !== "string") {
		throw new Error("Proof is not a string");
	}
	const parts = proof.split(".");
	if (parts.length !== 3) {
		throw new Error("Proof is not a JWS Compact Serialization");
	}
	const [headerSegment, payloadSegment, signatureSegment] = parts;

	const header = decodeJson(headerSegment, "header");
	if (header.typ !== "dpop+jwt") {
		throw new Error(`Proof 'typ' is '${header.typ}', expected 'dpop+jwt'`);
	}
	if (!algorithms.includes(header.alg)) {
		throw new Error(`Proof 'alg' is '${header.alg}', which is not allowed`);
	}
	const algorithm = ALGORITHMS[header.alg];

	const jwk = header.jwk;
	if (jwk?.kty !== algorithm.kty || jwk?.crv !== algorithm.crv) {
		throw new Error(`Proof 'jwk' does not match '${header.alg}'`);
	}
	for (const member of PRIVATE_MEMBERS) {
		if (jwk[member] !== undefined) {
			throw new Error("Proof 'jwk' carries private key material");
		}
	}

	let key;
	try {
		key = createPublicKey({ key: jwk, format: "jwk" });
	} catch {
		throw new Error("Proof 'jwk' is not a usable public key");
	}

	// `verify` returns false for a signature of any wrong length or shape; the
	// key itself is the only input that can make it throw, and createPublicKey
	// above has already rejected an unusable one.
	const valid = verify(
		algorithm.hash,
		Buffer.from(`${headerSegment}.${payloadSegment}`),
		{ key, ...algorithm.options },
		Buffer.from(signatureSegment, "base64url"),
	);
	if (!valid) {
		throw new Error("Proof signature is invalid");
	}

	const claims = decodeJson(payloadSegment, "payload");
	if (claims.htm !== method) {
		throw new Error(`Proof 'htm' is '${claims.htm}', expected '${method}'`);
	}
	if (
		typeof claims.htu !== "string" ||
		httpUri(claims.htu, "Proof 'htu'") !== httpUri(url, "The request URI")
	) {
		throw new Error(`Proof 'htu' is '${claims.htu}', expected '${url}'`);
	}

	const now = Math.floor(Date.now() / 1000);
	if (typeof claims.iat !== "number" || Math.abs(now - claims.iat) > maxAge) {
		throw new Error("Proof 'iat' is outside the acceptable window");
	}
	if (typeof claims.jti !== "string" || !claims.jti) {
		throw new Error("Proof is missing 'jti'");
	}

	// Binds the proof to one access token, so a proof captured alongside one
	// token cannot be paired with another.
	if (
		accessToken !== undefined &&
		claims.ath !== accessTokenHash(accessToken)
	) {
		throw new Error("Proof 'ath' does not match the presented access token");
	}

	return { jkt: jwkThumbprint(jwk), claims };
};

const httpDpopMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const algorithms = normalizeAlgorithms(options.algorithm);

	const httpDpopMiddlewareBefore = async (request) => {
		const result = await getInternal(options.payloadKey, request);
		const payload = result[sanitizeKey(options.payloadKey)];

		// A DPoP-bound token names its key in the `cnf` confirmation claim
		// (RFC 7800). Absent means the token is an ordinary bearer token, which
		// is what makes adoption incremental: existing clients keep working
		// until they choose to send a proof.
		const jkt = payload?.[options.confirmationClaim]?.jkt;
		if (jkt === undefined) {
			if (options.required) {
				throw new HttpError(401, {
					cause: {
						package: pkg,
						data: {
							reason: `Token carries no '${options.confirmationClaim}.jkt', and 'required' is set`,
						},
					},
				});
			}
			return;
		}

		const headers = request.event?.headers;

		// RFC 9449 §7.1: a bound token is no longer a bearer token. Accepting it
		// under the Bearer scheme would let a holder drop the scheme and the
		// proof together and talk its way back to bearer semantics.
		const authorization = readAuthorization(headers);
		if (!authorization?.toLowerCase().startsWith("dpop ")) {
			throw new HttpError(401, {
				cause: {
					package: pkg,
					data: {
						reason:
							"A DPoP-bound token must be sent with the DPoP authentication scheme",
					},
				},
			});
		}
		const accessToken = authorization.slice("dpop ".length);

		const proof = readProof(headers);
		if (typeof proof !== "string" || !proof) {
			throw new HttpError(401, {
				cause: { package: pkg, data: { reason: "Missing DPoP header" } },
			});
		}
		// Bounded before anything parses it, so a hostile proof cannot hand
		// `createPublicKey` a multi-megabyte RSA modulus to import.
		if (proof.length > options.maxProofLength) {
			throw new HttpError(401, {
				cause: {
					package: pkg,
					data: {
						reason: `DPoP header exceeds maxProofLength of ${options.maxProofLength}`,
					},
				},
			});
		}

		// Resolved and parsed here rather than inside the proof check, so a bad
		// `origin` option is a 500 the operator can act on and never a 401 the
		// caller is left to guess at.
		const origin = readOrigin(request.event, options.origin);
		const path = readPath(request.event);
		let url;
		try {
			url = httpUri(`${origin}${path}`, "The request URI");
		} catch {
			url = undefined;
		}
		if (origin === undefined || path === undefined || url === undefined) {
			throw new HttpError(500, {
				cause: {
					package: pkg,
					data: {
						reason: "Cannot determine the request URI: set the 'origin' option",
					},
				},
			});
		}

		let verified;
		try {
			verified = verifyDpopProof(proof, {
				method: readMethod(request.event),
				url,
				accessToken,
				algorithms,
				maxAge: options.maxAge,
			});
		} catch (e) {
			throw new HttpError(401, {
				cause: { package: pkg, data: { reason: e.message } },
			});
		}

		if (verified.jkt !== jkt) {
			throw new HttpError(401, {
				cause: {
					package: pkg,
					data: {
						reason: "Proof key does not match the token's confirmation claim",
					},
				},
			});
		}

		// Published so a later middleware can add replay protection of its own;
		// see the note on `jti` in the docs.
		request.internal[options.proofKey] = verified.claims;
		if (options.setToContext) {
			request.context[options.proofKey] = verified.claims;
		}
	};

	return {
		before: httpDpopMiddlewareBefore,
	};
};

export default httpDpopMiddleware;
