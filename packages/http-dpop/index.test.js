import { deepEqual, ok, strictEqual, throws } from "node:assert/strict";
import { constants, generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import middy from "../core/index.js";
import realHttpDpop, {
	accessTokenHash,
	httpDpopValidateOptions,
	jwkThumbprint,
	verifyDpopProof,
} from "./index.js";

// The verified proof lands on request.internal by default. Tests assert through
// request.context for convenience, so they opt in; the tests that cover the
// default call realHttpDpop directly.
const httpDpop = (opts = {}) => realHttpDpop({ setToContext: true, ...opts });

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const DOMAIN = "api.example.com";
const PATH = "/v1/things";
const TOKEN = "an.access.token";

// Signing parameters written out again rather than imported from index.js: a
// wrong table in the implementation must not be able to make its own tests pass.
const ALGORITHMS = {
	ES256: {
		keypair: () => generateKeyPairSync("ec", { namedCurve: "P-256" }),
		hash: "SHA256",
		options: { dsaEncoding: "ieee-p1363" },
	},
	ES384: {
		keypair: () => generateKeyPairSync("ec", { namedCurve: "P-384" }),
		hash: "SHA384",
		options: { dsaEncoding: "ieee-p1363" },
	},
	ES512: {
		keypair: () => generateKeyPairSync("ec", { namedCurve: "P-521" }),
		hash: "SHA512",
		options: { dsaEncoding: "ieee-p1363" },
	},
	PS256: {
		keypair: () => generateKeyPairSync("rsa", { modulusLength: 2048 }),
		hash: "SHA256",
		options: {
			padding: constants.RSA_PKCS1_PSS_PADDING,
			saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
		},
	},
	RS256: {
		keypair: () => generateKeyPairSync("rsa", { modulusLength: 2048 }),
		hash: "SHA256",
		options: {},
	},
	EdDSA: {
		keypair: () => generateKeyPairSync("ed25519"),
		hash: null,
		options: {},
	},
};

const publicJwk = (publicKey) => publicKey.export({ format: "jwk" });

const keyFor = (alg = "ES256") => {
	const { privateKey, publicKey } = ALGORITHMS[alg].keypair();
	const jwk = publicJwk(publicKey);
	return { alg, privateKey, publicKey, jwk, jkt: jwkThumbprint(jwk) };
};

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

// Mints a proof the way a client library would. Every part is overridable so a
// test can break exactly one thing. Pass `null` to leave a claim out; passing
// `undefined` would only re-select the default below.
const proofFor = (
	key,
	{
		alg = key.alg,
		typ = "dpop+jwt",
		jwk = key.jwk,
		htm = "GET",
		htu = `https://${DOMAIN}${PATH}`,
		iat = Math.floor(Date.now() / 1000),
		jti = "proof-1",
		ath = accessTokenHash(TOKEN),
		signWith = key.privateKey,
		signAs = key.alg,
		...rest
	} = {},
) => {
	const header = b64({ typ, alg, jwk });
	const claims = { jti, htm, htu, iat, ath, ...rest };
	for (const [k, v] of Object.entries(claims)) {
		if (v === null) delete claims[k];
	}
	const payload = b64(claims);
	const spec = ALGORITHMS[signAs];
	const signature = sign(spec.hash, Buffer.from(`${header}.${payload}`), {
		key: signWith,
		...spec.options,
	}).toString("base64url");
	return `${header}.${payload}.${signature}`;
};

const makeEvent = ({
	authorization = `DPoP ${TOKEN}`,
	dpop,
	path = PATH,
	method = "GET",
	domainName = DOMAIN,
	headers = {},
} = {}) => ({
	rawPath: path,
	headers: {
		...headers,
		...(authorization === null ? {} : { authorization }),
		...(dpop === undefined ? {} : { dpop }),
	},
	requestContext: {
		domainName,
		http: { method },
	},
});

// Stands in for @middy/http-jwt or @middy/http-paseto having verified the token
// and written its payload to request.internal.
const makeHandler = (payload, opts = {}) =>
	middy((event, context) => context.middyContext)
		.before((request) => {
			request.internal[opts.payloadKey ?? "jwt"] = payload;
		})
		.use(httpDpop(opts));

const boundPayload = (key, claim = "cnf") => ({
	sub: "user-1",
	[claim]: { jkt: key.jkt },
});

test("It should accept a bound token presented with a matching proof", async () => {
	const key = keyFor();
	const ctx = { ...defaultContext };
	const handler = makeHandler(boundPayload(key));

	const result = await handler(makeEvent({ dpop: proofFor(key) }), ctx);

	strictEqual(result.dpop.jti, "proof-1");
	strictEqual(result.dpop.htm, "GET");
	strictEqual(ctx.middyContext.dpop.htu, `https://${DOMAIN}${PATH}`);
});

for (const alg of Object.keys(ALGORITHMS)) {
	test(`It should verify a proof signed with ${alg}`, async () => {
		const key = keyFor(alg);
		const handler = makeHandler(boundPayload(key));

		const result = await handler(makeEvent({ dpop: proofFor(key) }), {
			...defaultContext,
		});

		strictEqual(result.dpop.jti, "proof-1");
	});
}

test("It should ignore a token that carries no confirmation claim", async () => {
	const ctx = { ...defaultContext };
	const handler = makeHandler({ sub: "user-1" });

	// No DPoP header at all, and a plain Bearer scheme: an unbound token is
	// still an ordinary bearer token, which is what makes adoption incremental.
	const result = await handler(
		makeEvent({ authorization: `Bearer ${TOKEN}` }),
		ctx,
	);

	strictEqual(result.dpop, undefined);
});

test("It should reject an unbound token when required is set", async () => {
	const handler = makeHandler({ sub: "user-1" }, { required: true });

	const result = await handler(
		makeEvent({ authorization: `Bearer ${TOKEN}` }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should reject a bound token sent with the Bearer scheme", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ authorization: `Bearer ${TOKEN}`, dpop: proofFor(key) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("DPoP authentication scheme"));
});

test("It should accept a lower-case dpop scheme", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ authorization: `dpop ${TOKEN}`, dpop: proofFor(key) }),
		{ ...defaultContext },
	);

	strictEqual(result.dpop.jti, "proof-1");
});

test("It should reject a bound token with no proof", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(makeEvent(), { ...defaultContext }).catch(
		(e) => e,
	);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("Missing DPoP header"));
});

test("It should reject a bound token with no authorization header", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ authorization: null, dpop: proofFor(key) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should reject a proof signed by a different key", async () => {
	const bound = keyFor();
	const other = keyFor();
	const handler = makeHandler(boundPayload(bound));

	const result = await handler(makeEvent({ dpop: proofFor(other) }), {
		...defaultContext,
	}).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("confirmation claim"));
});

test("It should reject a proof whose signature does not verify", async () => {
	const key = keyFor();
	const impostor = keyFor();
	const handler = makeHandler(boundPayload(key));

	// The right public key in the header, signed by somebody else's private key.
	const result = await handler(
		makeEvent({ dpop: proofFor(key, { signWith: impostor.privateKey }) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("signature is invalid"));
});

test("It should reject a proof minted for another method", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ dpop: proofFor(key, { htm: "POST" }) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("'htm'"));
});

test("It should reject a proof minted for another path", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ dpop: proofFor(key, { htu: `https://${DOMAIN}/v1/other` }) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("'htu'"));
});

test("It should reject a proof minted for another host", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	// The Host header is not consulted, so naming another origin cannot work.
	const result = await handler(
		makeEvent({
			dpop: proofFor(key, { htu: `https://evil.example${PATH}` }),
			headers: { host: "evil.example" },
		}),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should ignore the query string when comparing htu", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ dpop: proofFor(key, { htu: `https://${DOMAIN}${PATH}?a=1` }) }),
		{ ...defaultContext },
	);

	strictEqual(result.dpop.jti, "proof-1");
});

test("It should reject a proof whose htu is not a URL", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ dpop: proofFor(key, { htu: "not a url" }) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should reject a proof older than maxAge", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({
			dpop: proofFor(key, { iat: Math.floor(Date.now() / 1000) - 120 }),
		}),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("'iat'"));
});

test("It should honour a custom maxAge", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key), { maxAge: 600 });

	const result = await handler(
		makeEvent({
			dpop: proofFor(key, { iat: Math.floor(Date.now() / 1000) - 120 }),
		}),
		{ ...defaultContext },
	);

	strictEqual(result.dpop.jti, "proof-1");
});

test("It should reject a proof dated too far in the future", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({
			dpop: proofFor(key, { iat: Math.floor(Date.now() / 1000) + 3600 }),
		}),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should reject a proof with no jti", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ dpop: proofFor(key, { jti: null }) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("'jti'"));
});

test("It should reject a proof whose ath names another token", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ dpop: proofFor(key, { ath: accessTokenHash("other") }) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("'ath'"));
});

test("It should reject a proof with no ath at all", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ dpop: proofFor(key, { ath: null }) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should reject a JWT that is not a dpop+jwt", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ dpop: proofFor(key, { typ: "JWT" }) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("'typ'"));
});

test("It should reject an algorithm outside the configured list", async () => {
	const key = keyFor("RS256");
	const handler = makeHandler(boundPayload(key), { algorithm: "EdDSA" });

	const result = await handler(makeEvent({ dpop: proofFor(key) }), {
		...defaultContext,
	}).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("'alg'"));
});

test("It should accept an algorithm inside a narrowed list", async () => {
	const key = keyFor("EdDSA");
	const handler = makeHandler(boundPayload(key), {
		algorithm: ["EdDSA", "ES256"],
	});

	const result = await handler(makeEvent({ dpop: proofFor(key) }), {
		...defaultContext,
	});

	strictEqual(result.dpop.jti, "proof-1");
});

test("It should reject an RSA key wearing an ES256 alg", async () => {
	// Algorithm confusion: node:crypto ignores dsaEncoding on an RSA key, so
	// without the kty pin this would verify as RSA-SHA256 against a key the
	// sender chose.
	const key = keyFor("RS256");
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ dpop: proofFor(key, { alg: "ES256", signAs: "RS256" }) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("does not match"));
});

test("It should reject an EC key on the wrong curve for its alg", async () => {
	const key = keyFor("ES384");
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ dpop: proofFor(key, { alg: "ES256", signAs: "ES384" }) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("does not match"));
});

test("It should reject a proof carrying private key material", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({
			dpop: proofFor(key, { jwk: key.privateKey.export({ format: "jwk" }) }),
		}),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("private key material"));
});

test("It should reject a proof with an unusable jwk", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({
			dpop: proofFor(key, {
				jwk: { kty: "EC", crv: "P-256", x: "!!!", y: "!!!" },
			}),
		}),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should reject a malformed proof", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	for (const dpop of ["", "one.two", "a.b.c.d", "!!!.!!!.!!!"]) {
		const result = await handler(makeEvent({ dpop }), {
			...defaultContext,
		}).catch((e) => e);
		strictEqual(result.statusCode, 401);
	}
});

test("It should reject a proof whose header is not an object", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const dpop = `${Buffer.from('"a string"').toString("base64url")}.e30.AA`;
	const result = await handler(makeEvent({ dpop }), {
		...defaultContext,
	}).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should reject a proof longer than maxProofLength", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key), { maxProofLength: 32 });

	const result = await handler(makeEvent({ dpop: proofFor(key) }), {
		...defaultContext,
	}).catch((e) => e);

	strictEqual(result.statusCode, 401);
	ok(result.cause.data.reason.includes("maxProofLength"));
});

test("It should accept a single-entry repeated DPoP header", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(makeEvent({ dpop: [proofFor(key)] }), {
		...defaultContext,
	});

	strictEqual(result.dpop.jti, "proof-1");
});

test("It should read the header and the scheme however a proxy cases them", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	for (const headerName of ["DPoP", "Dpop"]) {
		const result = await handler(
			{
				rawPath: PATH,
				headers: {
					Authorization: [`DPoP ${TOKEN}`],
					[headerName]: proofFor(key),
				},
				requestContext: { domainName: DOMAIN, http: { method: "GET" } },
			},
			{ ...defaultContext },
		);
		strictEqual(result.dpop.jti, "proof-1");
	}
});

test("It should ignore headers that are not strings", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ authorization: 42, dpop: proofFor(key) }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should reject two DPoP headers", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		makeEvent({ dpop: [proofFor(key), proofFor(key, { jti: "proof-2" })] }),
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should prefer the origin option over the request domain", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key), {
		origin: "https://public.example.com",
	});

	const result = await handler(
		makeEvent({
			domainName: "internal.execute-api.amazonaws.com",
			dpop: proofFor(key, { htu: `https://public.example.com${PATH}` }),
		}),
		{ ...defaultContext },
	);

	strictEqual(result.dpop.jti, "proof-1");
});

test("It should throw a 500 when the request URI cannot be resolved", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		{
			rawPath: PATH,
			headers: {
				authorization: `DPoP ${TOKEN}`,
				dpop: proofFor(key),
			},
			requestContext: {},
		},
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 500);
	ok(result.cause.data.reason.includes("'origin' option"));
});

test("It should throw a 500 when the event carries no path", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		{
			headers: {
				authorization: `DPoP ${TOKEN}`,
				dpop: proofFor(key),
			},
			requestContext: { domainName: DOMAIN },
		},
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 500);
	ok(result.cause.data.reason.includes("'origin' option"));
});

test("It should throw a 500 when the origin option is not a URL", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key), { origin: "not a url" });

	const result = await handler(makeEvent({ dpop: proofFor(key) }), {
		...defaultContext,
	}).catch((e) => e);

	strictEqual(result.statusCode, 500);
});

test("It should read an API Gateway REST event", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		{
			path: PATH,
			httpMethod: "GET",
			headers: {
				authorization: `DPoP ${TOKEN}`,
				dpop: proofFor(key),
			},
			requestContext: { domainName: DOMAIN },
		},
		{ ...defaultContext },
	);

	strictEqual(result.dpop.jti, "proof-1");
});

test("It should read an ALB event when origin is configured", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key), {
		origin: `https://${DOMAIN}`,
	});

	const result = await handler(
		{
			path: PATH,
			httpMethod: "GET",
			headers: {
				authorization: `DPoP ${TOKEN}`,
				dpop: proofFor(key),
			},
		},
		{ ...defaultContext },
	);

	strictEqual(result.dpop.jti, "proof-1");
});

test("It should use a custom payloadKey, proofKey and confirmationClaim", async () => {
	const key = keyFor();
	const handler = middy((event, context) => context.middyContext)
		.before((request) => {
			request.internal.paseto = boundPayload(key, "confirmation");
		})
		.use(
			httpDpop({
				payloadKey: "paseto",
				proofKey: "possession",
				confirmationClaim: "confirmation",
			}),
		);

	const result = await handler(makeEvent({ dpop: proofFor(key) }), {
		...defaultContext,
	});

	strictEqual(result.possession.jti, "proof-1");
});

test("It should write only to internal by default", async () => {
	const key = keyFor();
	const ctx = { ...defaultContext };
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.jwt = boundPayload(key);
		})
		.use(realHttpDpop())
		.after((request) => {
			strictEqual(request.internal.dpop.jti, "proof-1");
		});

	await handler(makeEvent({ dpop: proofFor(key) }), ctx);

	strictEqual(ctx.middyContext.dpop, undefined);
});

test("It should throw at construction on an unknown algorithm", () => {
	throws(() => realHttpDpop({ algorithm: "HS256" }), {
		name: "TypeError",
	});
});

test("It should validate its options", () => {
	throws(() => httpDpopValidateOptions({ nope: true }));
	httpDpopValidateOptions({
		payloadKey: "jwt",
		proofKey: "dpop",
		confirmationClaim: "cnf",
		origin: "https://api.example.com",
		algorithm: ["ES256"],
		maxAge: 60,
		maxProofLength: 8192,
		required: true,
		setToContext: true,
	});
});

test("jwkThumbprint matches the RFC 7638 worked example", () => {
	// https://www.rfc-editor.org/rfc/rfc7638#section-3.1
	const jwk = {
		kty: "RSA",
		n: "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
		e: "AQAB",
		alg: "RS256",
		kid: "2011-04-29",
	};

	strictEqual(
		jwkThumbprint(jwk),
		"NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs",
	);
});

test("jwkThumbprint rejects a key type it cannot name", () => {
	throws(() => jwkThumbprint({ kty: "oct", k: "abc" }), /Unsupported JWK/);
	throws(() => jwkThumbprint(undefined), /Unsupported JWK/);
	throws(() => jwkThumbprint({ kty: "EC", crv: "P-256", x: "a" }), /'y'/);
});

test("accessTokenHash hashes the token as presented", () => {
	strictEqual(
		accessTokenHash("hello"),
		Buffer.from(
			"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
			"hex",
		).toString("base64url"),
	);
});

test("verifyDpopProof is usable on its own", () => {
	const key = keyFor();

	const { jkt, claims } = verifyDpopProof(proofFor(key), {
		method: "GET",
		url: `https://${DOMAIN}${PATH}`,
		accessToken: TOKEN,
	});

	strictEqual(jkt, key.jkt);
	deepEqual(claims.jti, "proof-1");
});

// This is the token endpoint's side of the exchange: the proof demonstrates
// possession before any access token exists, so there is nothing for `ath` to
// name yet.
test("verifyDpopProof skips the ath check when no token is given", () => {
	const key = keyFor();
	const proof = proofFor(key, {
		ath: null,
		htm: "POST",
		htu: `https://${DOMAIN}/oauth/token`,
	});

	const { jkt } = verifyDpopProof(proof, {
		method: "POST",
		url: `https://${DOMAIN}/oauth/token`,
	});

	strictEqual(jkt, key.jkt);
});

test("verifyDpopProof throws a plain Error on junk", () => {
	throws(() => verifyDpopProof(undefined), { name: "Error" });
	throws(() => verifyDpopProof(42), { name: "Error" });
	throws(() => verifyDpopProof("a.b"), { name: "Error" });
});

// ---------- verifyDpopProof guard messages ----------
// The middleware turns every one of these into the same 401, so the guards are
// only distinguishable through verifyDpopProof's own error text. Asserting the
// exact message is what pins which guard fired.

const VERIFY_OPTS = {
	method: "GET",
	url: `https://${DOMAIN}${PATH}`,
	accessToken: TOKEN,
};

const expectMessage = (fn, message) => {
	throws(fn, (e) => {
		strictEqual(e.message, message);
		return true;
	});
};

test("verifyDpopProof names the guard that rejected the proof", () => {
	const key = keyFor();

	expectMessage(
		() => verifyDpopProof(42, VERIFY_OPTS),
		"Proof is not a string",
	);
	expectMessage(
		() => verifyDpopProof("a.b", VERIFY_OPTS),
		"Proof is not a JWS Compact Serialization",
	);
	expectMessage(
		() => verifyDpopProof("!!!.b.c", VERIFY_OPTS),
		"Proof header is not JSON",
	);
	expectMessage(
		() =>
			verifyDpopProof(
				`${Buffer.from("[1,2]").toString("base64url")}.b.c`,
				VERIFY_OPTS,
			),
		"Proof header is not an object",
	);
	expectMessage(
		() => verifyDpopProof(proofFor(key, { typ: "jwt" }), VERIFY_OPTS),
		"Proof 'typ' is 'jwt', expected 'dpop+jwt'",
	);
	expectMessage(
		() =>
			verifyDpopProof(proofFor(key), { ...VERIFY_OPTS, algorithms: ["ES384"] }),
		"Proof 'alg' is 'ES256', which is not allowed",
	);
	expectMessage(
		() =>
			verifyDpopProof(
				proofFor(key, { jwk: { ...key.jwk, crv: "P-384" } }),
				VERIFY_OPTS,
			),
		"Proof 'jwk' does not match 'ES256'",
	);
	expectMessage(
		() =>
			verifyDpopProof(
				proofFor(key, { jwk: { ...key.jwk, x: "not-a-point" } }),
				VERIFY_OPTS,
			),
		"Proof 'jwk' is not a usable public key",
	);
	expectMessage(
		() => verifyDpopProof(proofFor(key, { htm: "POST" }), VERIFY_OPTS),
		"Proof 'htm' is 'POST', expected 'GET'",
	);
	expectMessage(
		() => verifyDpopProof(proofFor(key, { htm: null }), VERIFY_OPTS),
		"Proof 'htm' is 'undefined', expected 'GET'",
	);
	expectMessage(
		() => verifyDpopProof(proofFor(key, { htu: null }), VERIFY_OPTS),
		`Proof 'htu' is 'undefined', expected '${VERIFY_OPTS.url}'`,
	);
	expectMessage(
		() => verifyDpopProof(proofFor(key, { htu: "not a url" }), VERIFY_OPTS),
		"Proof 'htu' is not a URL",
	);
	expectMessage(
		() => verifyDpopProof(proofFor(key), { ...VERIFY_OPTS, url: "not a url" }),
		"The request URI is not a URL",
	);
	expectMessage(
		() => verifyDpopProof(proofFor(key, { iat: null }), VERIFY_OPTS),
		"Proof 'iat' is outside the acceptable window",
	);
	expectMessage(
		() => verifyDpopProof(proofFor(key, { jti: "" }), VERIFY_OPTS),
		"Proof is missing 'jti'",
	);
	expectMessage(
		() => verifyDpopProof(proofFor(key, { jti: 7 }), VERIFY_OPTS),
		"Proof is missing 'jti'",
	);
	expectMessage(
		() => verifyDpopProof(proofFor(key, { ath: "wrong" }), VERIFY_OPTS),
		"Proof 'ath' does not match the presented access token",
	);
});

// The signature is checked before the payload is decoded, so a tampered
// payload fails on the signature first. Reaching the payload guards needs a
// proof genuinely signed over the malformed segment.
const proofWithRawPayload = (key, payloadSegment) => {
	const header = Buffer.from(
		JSON.stringify({ typ: "dpop+jwt", alg: key.alg, jwk: key.jwk }),
	).toString("base64url");
	const spec = ALGORITHMS[key.alg];
	const signature = sign(
		spec.hash,
		Buffer.from(`${header}.${payloadSegment}`),
		{ key: key.privateKey, ...spec.options },
	).toString("base64url");
	return `${header}.${payloadSegment}.${signature}`;
};

test("verifyDpopProof rejects a payload that is not a JSON object", () => {
	const key = keyFor();

	expectMessage(
		() =>
			verifyDpopProof(
				proofWithRawPayload(key, Buffer.from("not json").toString("base64url")),
				VERIFY_OPTS,
			),
		"Proof payload is not JSON",
	);
	expectMessage(
		() =>
			verifyDpopProof(
				proofWithRawPayload(key, Buffer.from("[1,2]").toString("base64url")),
				VERIFY_OPTS,
			),
		"Proof payload is not an object",
	);
});

test("verifyDpopProof rejects every private JWK member", () => {
	// Each member of the private-material list must be rejected on its own; a
	// list missing one would let that member through unnoticed.
	const key = keyFor();
	for (const member of ["d", "p", "q", "dp", "dq", "qi", "k"]) {
		expectMessage(
			() =>
				verifyDpopProof(
					proofFor(key, { jwk: { ...key.jwk, [member]: "x" } }),
					VERIFY_OPTS,
				),
			"Proof 'jwk' carries private key material",
		);
	}
});

test("jwkThumbprint reports the offending key type and member on the cause", () => {
	// The message names the problem; the cause is what a caller can branch on.
	throws(
		() => jwkThumbprint({ kty: "oct", k: "abc" }),
		(e) => {
			strictEqual(e.message, "Unsupported JWK key type 'oct'");
			strictEqual(e.cause.package, "@middy/http-dpop");
			strictEqual(e.cause.data.kty, "oct");
			return true;
		},
	);
	throws(
		() => jwkThumbprint(undefined),
		(e) => {
			strictEqual(e.message, "Unsupported JWK key type 'undefined'");
			strictEqual(e.cause.data.kty, undefined);
			return true;
		},
	);
	throws(
		() => jwkThumbprint({ kty: "EC", crv: "P-256", x: "a" }),
		(e) => {
			strictEqual(e.message, "JWK is missing required member 'y'");
			strictEqual(e.cause.package, "@middy/http-dpop");
			strictEqual(e.cause.data.member, "y");
			return true;
		},
	);
});

test("jwkThumbprint hashes only the members RFC 7638 names for each key type", () => {
	// An extra member must not change the thumbprint, and each key type has its
	// own member list.
	const okp = { kty: "OKP", crv: "Ed25519", x: "abc" };
	strictEqual(jwkThumbprint(okp), jwkThumbprint({ ...okp, use: "sig" }));
	throws(
		() => jwkThumbprint({ kty: "OKP", crv: "Ed25519" }),
		(e) => {
			strictEqual(e.cause.data.member, "x");
			return true;
		},
	);

	const rsa = { kty: "RSA", e: "AQAB", n: "abc" };
	strictEqual(jwkThumbprint(rsa), jwkThumbprint({ ...rsa, alg: "RS256" }));
	throws(
		() => jwkThumbprint({ kty: "RSA", e: "AQAB" }),
		(e) => {
			strictEqual(e.cause.data.member, "n");
			return true;
		},
	);
});

test("verifyDpopProof rejects a JSON null header or payload", () => {
	// `null` is typeof "object", so only the explicit null check rejects it.
	const key = keyFor();
	const nullSegment = Buffer.from("null").toString("base64url");

	expectMessage(
		() => verifyDpopProof(`${nullSegment}.b.c`, VERIFY_OPTS),
		"Proof header is not an object",
	);
	expectMessage(
		() => verifyDpopProof(proofWithRawPayload(key, nullSegment), VERIFY_OPTS),
		"Proof payload is not an object",
	);
});

// ---------- middleware rejection reasons and event readers ----------

test("It should name the reason when a required binding is absent", async () => {
	// Every rejection is a 401, so the reason string is the only way to tell
	// which guard fired.
	const handler = makeHandler({ sub: "user" }, { required: true });

	const result = await handler(makeEvent(), { ...defaultContext }).catch(
		(e) => e,
	);

	strictEqual(result.statusCode, 401);
	strictEqual(
		result.cause.data.reason,
		"Token carries no 'cnf.jkt', and 'required' is set",
	);
	strictEqual(result.cause.package, "@middy/http-dpop");
});

test("It should name the confirmationClaim option in the required reason", async () => {
	const handler = makeHandler(
		{ sub: "user" },
		{ required: true, confirmationClaim: "binding" },
	);

	const result = await handler(makeEvent(), { ...defaultContext }).catch(
		(e) => e,
	);

	strictEqual(
		result.cause.data.reason,
		"Token carries no 'binding.jkt', and 'required' is set",
	);
});

test("It should reject when the event carries no origin and none is configured", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(
		{
			rawPath: PATH,
			requestContext: { http: { method: "GET" } },
			headers: { authorization: `DPoP ${TOKEN}`, dpop: proofFor(key) },
		},
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 500);
});

test("It should ignore a non-string dpop header value", async () => {
	// asString() keeps a non-string header from reaching the parser; without it
	// the proof guard would see a truthy non-string.
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(makeEvent({ dpop: 42 }), {
		...defaultContext,
	}).catch((e) => e);

	strictEqual(result.statusCode, 401);
	strictEqual(result.cause.data.reason, "Missing DPoP header");
});

test("It should name the unsupported algorithm and its allowed set", () => {
	// The message is the only place the caller learns which algorithms exist.
	throws(
		() => realHttpDpop({ algorithm: "HS256" }),
		(e) => {
			ok(
				e.message.startsWith("Unsupported algorithm 'HS256', expected one of "),
			);
			ok(e.message.includes("ES256, "));
			strictEqual(e.cause.package, "@middy/http-dpop");
			return true;
		},
	);
});

test("It should tolerate a null event", async () => {
	// Lambda hands middy whatever the caller sent; `event = {}` only defaults an
	// absent event, so every reader has to survive an explicit null.
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	// With no headers at all the authorization check rejects first; the point
	// is that reading a null event raises that 401 rather than a TypeError.
	const result = await handler(null, { ...defaultContext }).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should tolerate an event with no headers", async () => {
	const key = keyFor();
	const handler = makeHandler(boundPayload(key), {
		origin: `https://${DOMAIN}`,
	});

	const result = await handler(
		{ rawPath: PATH, requestContext: { http: { method: "GET" } } },
		{ ...defaultContext },
	).catch((e) => e);

	strictEqual(result.statusCode, 401);
});

test("It should reject an empty DPoP header", async () => {
	// An empty string is a string, so the emptiness check has to be a separate
	// arm of the guard rather than folded into the type check.
	const key = keyFor();
	const handler = makeHandler(boundPayload(key));

	const result = await handler(makeEvent({ dpop: "" }), {
		...defaultContext,
	}).catch((e) => e);

	strictEqual(result.statusCode, 401);
	strictEqual(result.cause.data.reason, "Missing DPoP header");
});

test("verifyDpopProof rejects a header that decodes to a bare JSON value", () => {
	// Not null, not an array, but not an object either.
	expectMessage(
		() =>
			verifyDpopProof(
				`${Buffer.from("5").toString("base64url")}.b.c`,
				VERIFY_OPTS,
			),
		"Proof header is not an object",
	);
});

test("verifyDpopProof rejects a jwk whose kty is wrong but crv matches", () => {
	// Both arms of the jwk check must stand alone: a matching crv cannot excuse
	// a mismatched kty.
	const key = keyFor();
	expectMessage(
		() =>
			verifyDpopProof(
				proofFor(key, { jwk: { ...key.jwk, kty: "RSA" } }),
				VERIFY_OPTS,
			),
		"Proof 'jwk' does not match 'ES256'",
	);
	expectMessage(
		// `undefined` would re-select proofFor's default; `null` omits the member.
		() => verifyDpopProof(proofFor(key, { jwk: null }), VERIFY_OPTS),
		"Proof 'jwk' does not match 'ES256'",
	);
});

test("verifyDpopProof accepts a proof exactly maxAge seconds old", () => {
	// The window is inclusive: `> maxAge` rejects, `>= maxAge` would reject the
	// boundary too.
	const key = keyFor();
	const now = Math.floor(Date.now() / 1000);
	const proof = proofFor(key, { iat: now - 60 });

	const { jkt } = verifyDpopProof(proof, { ...VERIFY_OPTS, maxAge: 60 });
	strictEqual(jkt, key.jkt);
});

test("It should pass through when no verified payload was written", async () => {
	// The token middleware may not have run at all; reading its payload key
	// then yields undefined, which must be treated as an unbound request rather
	// than crashing.
	const key = keyFor();
	const handler = middy((event, context) => context.middyContext).use(
		httpDpop(),
	);

	const result = await handler(makeEvent({ dpop: proofFor(key) }), {
		...defaultContext,
	});

	strictEqual(result.dpop, undefined);
});

test("It should accept a proof of exactly maxProofLength", async () => {
	// The cap is `>`, so a proof of exactly the limit is still allowed;
	// `>=` would reject it.
	const key = keyFor();
	const proof = proofFor(key);
	const handler = makeHandler(boundPayload(key), {
		maxProofLength: proof.length,
	});

	const result = await handler(makeEvent({ dpop: proof }), {
		...defaultContext,
	});

	strictEqual(result.dpop.jti, "proof-1");
});
