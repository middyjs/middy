// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { constants, createHash, createPublicKey, verify } from "node:crypto";
import {
	getInternal,
	HttpError,
	sanitizeKey,
	setContextNamespace,
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
	// `hasOwn`, not a truthiness check: `kty: "constructor"` otherwise resolves
	// to a member of Object.prototype and this reads as a supported key type.
	if (!Object.hasOwn(THUMBPRINT_MEMBERS, jwk?.kty)) {
		throw new Error(`Unsupported JWK key type '${jwk?.kty}'`, {
			cause: { package: pkg, data: { kty: jwk?.kty } },
		});
	}
	const canonical = {};
	for (const member of THUMBPRINT_MEMBERS[jwk.kty]) {
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

// Parsed at construction, like `algorithm`: an origin that cannot be a URL
// cannot serve any request, so it should stop a deployment rather than 500 on
// every one of them. The trailing slash goes here too, because it doubles the
// `/` in front of every path and then fails every comparison as silently as a
// genuinely wrong `htu`.
const normalizeOrigin = (origin) => {
	if (origin === undefined) return undefined;
	let uri;
	try {
		uri = httpUri(origin, "Option 'origin'");
	} catch {
		throw new TypeError(`Option 'origin' is not a URL: '${origin}'`, {
			cause: { package: pkg },
		});
	}
	return uri.replace(/\/+$/, "");
};

const normalizeAlgorithms = (algorithm) => {
	if (algorithm === undefined) return ALGORITHM_NAMES;
	const list = Array.isArray(algorithm) ? algorithm : [algorithm];
	for (const alg of list) {
		// `hasOwn` for the same reason as in `jwkThumbprint`: `'constructor'`
		// would otherwise pass here and then resolve to a table entry with no
		// `kty`, which every real JWK fails against for the wrong reason.
		if (!Object.hasOwn(ALGORITHMS, alg)) {
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
	// Stryker disable next-line OptionalChaining: equivalent. Both readers only run once the authorization and proof headers have been read off the event, which cannot happen for a null event, so the `event?.` links never short-circuit in practice. They stay because the readers are defensive about a shape Lambda does not guarantee.
	asString(event?.requestContext?.http?.method) ?? asString(event?.httpMethod);

// `htu` names the URI the client requested, so the path has to be the one that
// arrived rather than the one the router matched. API Gateway REST strips the
// stage from `event.path` and keeps it on `requestContext.path`, so preferring
// the latter is what makes a stage other than `$default` work at all. HTTP
// (v2) has no `requestContext.path`; ALB has neither, and only `path`.
// Stryker disable next-line OptionalChaining: equivalent, for the same reason as readMethod above.
const readPath = (event) =>
	asString(event?.rawPath) ??
	asString(event?.requestContext?.path) ??
	asString(event?.path);

// Never the Host header: a client controls it, so trusting it would let a proof
// be minted for any origin the attacker chose. `requestContext.domainName` is
// set by API Gateway from the domain that actually served the request, which is
// why it is a safe fallback. Behind a CDN or any other proxy, set `origin`.
const readOrigin = (event, configured) => {
	if (configured) return configured;
	// Stryker disable next-line OptionalChaining: equivalent, for the same reason as readMethod above.
	const domainName = asString(event?.requestContext?.domainName);
	return domainName ? `https://${domainName}` : undefined;
};

// Exactly one DPoP header, per RFC 9449 §4.3 step 1. Proxies can deliver a
// repeated header as an array, and two proofs is ambiguous rather than merely
// redundant, so it is refused instead of resolved.
const readProof = (headers) => {
	// Stryker disable next-line OptionalChaining: equivalent. readAuthorization runs first and rejects when `headers` is absent, so this reader is never reached with an undefined `headers`.
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
	// Stryker disable next-line OptionalChaining: equivalent. `||` only evaluates the second arm when the first is false, which requires `jwk.kty` to have matched, so `jwk` is never nullish here.
	if (jwk?.kty !== algorithm.kty || jwk?.crv !== algorithm.crv) {
		throw new Error(`Proof 'jwk' does not match '${header.alg}'`);
	}
	for (const member of PRIVATE_MEMBERS) {
		if (jwk[member] !== undefined) {
			throw new Error("Proof 'jwk' carries private key material");
		}
	}

	// OpenSSL only caps the public exponent above a 3072-bit modulus, so a
	// 3072-bit modulus paired with an exponent almost as large fits inside any
	// sane `maxProofLength` and costs ~100x a normal verify. 64 bits is the
	// ceiling OpenSSL itself applies to larger moduli, and is far above 65537.
	if (
		jwk.kty === "RSA" &&
		typeof jwk.e === "string" &&
		Buffer.byteLength(jwk.e, "base64url") > 8
	) {
		throw new Error("Proof 'jwk' has an oversized RSA public exponent");
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
	const origin = normalizeOrigin(options.origin);

	// RFC 9449 §7.1: a resource that refuses a request SHOULD name the scheme it
	// wants and the proof algorithms it will accept, so a client can answer
	// rather than guess. `http-error-handler` copies `error.headers` onto the
	// response. No `error` parameter: `invalid_dpop_proof` would be a lie on the
	// refusals below that are about the token rather than the proof.
	const wwwAuthenticate = {
		"WWW-Authenticate": `DPoP algs="${algorithms.join(" ")}"`,
	};

	const unauthorized = (reason) => {
		const error = new HttpError(401, {
			cause: { package: pkg, data: { reason } },
		});
		error.headers = wwwAuthenticate;
		return error;
	};

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
				throw unauthorized(
					`Token carries no '${options.confirmationClaim}.jkt', and 'required' is set`,
				);
			}
			return;
		}

		const headers = request.event?.headers;

		// RFC 9449 §7.1: a bound token is no longer a bearer token. Accepting it
		// under the Bearer scheme would let a holder drop the scheme and the
		// proof together and talk its way back to bearer semantics.
		const authorization = readAuthorization(headers);
		if (!authorization?.toLowerCase().startsWith("dpop ")) {
			throw unauthorized(
				"A DPoP-bound token must be sent with the DPoP authentication scheme",
			);
		}
		const accessToken = authorization.slice("dpop ".length);

		const proof = readProof(headers);
		// Stryker disable next-line ConditionalExpression: equivalent. readProof returns a string or undefined, so the type check can only be true when the value is also falsy; `!proof` alone covers every reachable case.
		if (typeof proof !== "string" || !proof) {
			throw unauthorized("Missing DPoP header");
		}
		// Bounded before anything parses it, so a hostile proof cannot hand
		// `createPublicKey` a multi-megabyte RSA modulus to import.
		if (proof.length > options.maxProofLength) {
			throw unauthorized(
				`DPoP header exceeds maxProofLength of ${options.maxProofLength}`,
			);
		}

		// Resolved and parsed here rather than inside the proof check, so an
		// undeterminable request URI — an ALB, or anything else with no
		// `requestContext.domainName`, and no `origin` configured — is a 500 the
		// operator can act on and never a 401 the caller is left to guess at. A
		// malformed `origin` never reaches this point; it fails at construction.
		const requestOrigin = readOrigin(request.event, origin);
		const path = readPath(request.event);
		let url;
		try {
			// Stryker disable next-line StringLiteral: equivalent. The label only appears in the error httpUri throws, which this catch discards in favour of `url = undefined`.
			url = httpUri(`${requestOrigin}${path}`, "The request URI");
		} catch {
			// `url` was declared without an initialiser, so it is already
			// undefined here; the check below is what reports it.
		}
		// Stryker disable next-line ConditionalExpression: equivalent. An undefined requestOrigin makes the template above unparseable, so `url` is undefined too and the third arm already rejects.
		if (
			requestOrigin === undefined ||
			path === undefined ||
			url === undefined
		) {
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
			throw unauthorized(e.message);
		}

		if (verified.jkt !== jkt) {
			throw unauthorized(
				"Proof key does not match the token's confirmation claim",
			);
		}

		// Published so a later middleware can add replay protection of its own;
		// see the note on `jti` in the docs.
		request.internal[options.proofKey] = verified.claims;
		if (options.setToContext) {
			setContextNamespace(request, options.proofKey, verified.claims);
		}
	};

	return {
		before: httpDpopMiddlewareBefore,
	};
};

export default httpDpopMiddleware;
