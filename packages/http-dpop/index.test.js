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
