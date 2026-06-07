import { ok, strictEqual } from "node:assert/strict";
import { generateKeyPair } from "node:crypto";
import { test } from "node:test";
import { promisify } from "node:util";
import { exportJWK, importPKCS8, SignJWT } from "jose";
import middy from "../core/index.js";
import realHttpJwt, { httpJwtValidateOptions } from "./index.js";

// Test helper: tests below pre-date the removal of the `secretKey` option.
// To avoid rewriting every test, the helper translates `secretKey` shorthand
// into the supported internalKey + before-injection pattern. It also defaults
// `setToContext: true` so assertions can read from context (the middleware's
// default is internal-only, matching `ssm`/`secrets-manager`).
let internalKeyCounter = 0;
const httpJwt = (opts = {}) => {
	const { secretKey, ...rest } = opts;
	if (secretKey !== undefined) {
		const internalKey = `hmacSecret${++internalKeyCounter}`;
		const real = realHttpJwt({
			setToContext: true,
			internalKey,
			...rest,
		});
		return {
			before: async (request) => {
				request.internal[internalKey] = secretKey;
				return real.before(request);
			},
		};
	}
	return realHttpJwt({ setToContext: true, ...opts });
};

const generateKeyPairAsync = promisify(generateKeyPair);

const jwksFixture = async ({
	kty = "rsa",
	alg = "RS256",
	kid = "test-kid",
	namedCurve,
} = {}) => {
	const opts =
		kty === "rsa"
			? { modulusLength: 2048 }
			: kty === "ec"
				? { namedCurve: namedCurve ?? "P-256" }
				: {};
	const { privateKey, publicKey } = await generateKeyPairAsync(kty, opts);
	const jwk = await exportJWK(publicKey);
	jwk.kid = kid;
	jwk.alg = alg;
	jwk.use = "sig";
	return { privateKey, publicKey, jwk, kid, alg };
};

const signToken = async ({ privateKey, alg, kid, iss, aud, claims = {} }) => {
	const sjwt = new SignJWT({ ...claims })
		.setProtectedHeader({ alg, kid })
		.setIssuedAt()
		.setExpirationTime("1h");
	if (iss) sjwt.setIssuer(iss);
	if (aud) sjwt.setAudience(aud);
	return sjwt.sign(privateKey);
};

const installFetch = (responses) => {
	const original = globalThis.fetch;
	const calls = [];
	globalThis.fetch = async (input, init) => {
		const url = typeof input === "string" ? input : input.url;
		calls.push({ url, init });
		const handler = responses[url];
		if (!handler) {
			return new Response("not found", { status: 404 });
		}
		return handler();
	};
	return {
		calls,
		restore: () => {
			globalThis.fetch = original;
		},
	};
};

const jwksResponse = (jwksDoc) => () =>
	new Response(JSON.stringify(jwksDoc), {
		status: 200,
		headers: { "content-type": "application/json" },
	});

let urlCounter = 0;
const nextJwksUri = () => {
	urlCounter += 1;
	return `https://test-${urlCounter}.example.com/.well-known/jwks.json`;
};

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const makeEvent = (authorization) => ({
	headers: { authorization },
});

test("It should verify a valid HS256 JWT and set payload to internal", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-1", role: "admin" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({ secretKey: secret, algorithm: "HS256" }),
	);

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.jwt.sub, "user-1");
	strictEqual(result.jwt.role, "admin");
});

test("It should always set payload to request.context", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-1" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const ctx = { ...defaultContext };
	const handler = middy(() => {}).use(
		httpJwt({ secretKey: secret, algorithm: "HS256" }),
	);

	await handler(makeEvent(`Bearer ${token}`), ctx);

	strictEqual(ctx.jwt.sub, "user-1");
});

test("It should use a custom payloadKey", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-1" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const ctx = { ...defaultContext };
	const handler = middy(() => ctx).use(
		httpJwt({ secretKey: secret, algorithm: "HS256", payloadKey: "auth" }),
	);

	const result = await handler(makeEvent(`Bearer ${token}`), ctx);
	strictEqual(result.auth.sub, "user-1");
});

test("It should verify with RS256 using internalKey", async (t) => {
	const { privateKey, publicKey } = await generateKeyPairAsync("rsa", {
		modulusLength: 2048,
	});

	const _pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const importedPrivate = await importPKCS8(
		privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
		"RS256",
	);

	const token = await new SignJWT({ sub: "user-2" })
		.setProtectedHeader({ alg: "RS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(importedPrivate);

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpJwt({ internalKey: "pubKey", algorithm: "RS256" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.jwt.sub, "user-2");
});

test("It should reject an HS256 token forged via algorithm confusion on a string key", async (t) => {
	const { publicKey } = await generateKeyPairAsync("rsa", {
		modulusLength: 2048,
	});
	const publicPem = publicKey
		.export({ type: "spki", format: "pem" })
		.toString();

	// Attacker forges an HS256 token using the (public) key bytes as the HMAC
	// secret. With a raw string key and a mixed RS256+HS256 allowlist this would
	// otherwise verify (classic RS/HS algorithm confusion).
	const forged = await new SignJWT({ sub: "attacker" })
		.setProtectedHeader({ alg: "HS256" })
		.sign(Buffer.from(publicPem));

	const handler = middy(() => true)
		.before((request) => {
			request.internal.pubkey = publicPem;
		})
		.use(httpJwt({ internalKey: "pubkey", algorithm: ["RS256", "HS256"] }));

	try {
		await handler(makeEvent(`Bearer ${forged}`), { ...defaultContext });
		ok(false, "alg-confusion: forged HS256 token was accepted");
	} catch (e) {
		strictEqual(e.statusCode, 500);
		strictEqual(e.message, "Internal Server Error");
		strictEqual(e.cause.package, "@middy/http-jwt");
		ok(
			e.cause.data.includes(
				"internalKey 'pubkey' is a string secret but 'algorithm' includes a non-symmetric value",
			),
		);
		ok(
			e.cause.data.includes("string keys may only be used with HS* algorithms"),
		);
	}
});

test("It should throw 401 when Authorization header is missing", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({ secretKey: "secret", algorithm: "HS256" }),
	);

	try {
		await handler({ headers: {} }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.message, "Unauthorized");
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should throw 401 when Authorization scheme is not Bearer", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({ secretKey: "secret", algorithm: "HS256" }),
	);

	try {
		await handler(makeEvent("Basic dXNlcjpwYXNz"), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
	}
});

test("It should throw 401 when token is invalid", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({ secretKey: "correct-secret", algorithm: "HS256" }),
	);

	const token = await new SignJWT({ sub: "x" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from("wrong-secret"));

	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
	}
});

test("It should throw 401 when token is expired", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-1" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("-1s")
		.sign(Buffer.from(secret));

	const handler = middy(() => {}).use(
		httpJwt({ secretKey: secret, algorithm: "HS256" }),
	);

	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
	}
});

test("It should verify audience claim", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({
		sub: "user-1",
		aud: "https://api.example.com",
	})
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			audience: "https://api.example.com",
		}),
	);

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-1");
});

test("It should throw 401 when issuer does not match", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-1" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer("wrong-issuer")
		.sign(Buffer.from(secret));

	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			issuer: "expected-issuer",
		}),
	);

	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
	}
});

test("It should throw TypeError at factory when no key source is configured", () => {
	try {
		httpJwt({});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should throw TypeError at factory when internalKey is set without algorithm", () => {
	try {
		realHttpJwt({ internalKey: "anyKey" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should accept lowercase authorization header", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-1" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({ secretKey: secret, algorithm: "HS256" }),
	);

	const result = await handler(
		{ headers: { authorization: `Bearer ${token}` } },
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "user-1");
});

test("It should read JWT from a cookie when tokenCookieName is set", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-1" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenCookieName: "access_token",
		}),
	);

	const result = await handler(
		{ headers: { cookie: `other=val; access_token=${token}; extra=1` } },
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "user-1");
});

test("It should read JWT from capitalized Cookie header when lowercase is absent", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-1" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenCookieName: "access_token",
		}),
	);

	const result = await handler(
		{ headers: { Cookie: `access_token=${token}` } },
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "user-1");
});

test("It should throw 401 when cookie is missing", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: "s",
			algorithm: "HS256",
			tokenCookieName: "access_token",
		}),
	);

	try {
		await handler({ headers: { cookie: "other=val" } }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should throw 401 when no cookie header is present at all", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: "s",
			algorithm: "HS256",
			tokenCookieName: "access_token",
		}),
	);

	try {
		await handler({ headers: {} }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should verify a JWT with KMS-shape { publicKey, keySpec } when algorithm is set", async (t) => {
	const { privateKey, publicKey } = await generateKeyPairAsync("rsa", {
		modulusLength: 2048,
	});

	const importedPrivate = await importPKCS8(
		privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
		"RS256",
	);

	const token = await new SignJWT({ sub: "user-kms" })
		.setProtectedHeader({ alg: "RS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(importedPrivate);

	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.kmsKey = {
				publicKey: new Uint8Array(spkiDer),
				keySpec: "RSA_2048",
			};
		})
		.use(httpJwt({ internalKey: "kmsKey", algorithm: "RS256" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.jwt.sub, "user-kms");
});

test("It should throw 500 when internalKey resolves to undefined", async (t) => {
	const handler = middy(() => {})
		.before((request) => {
			request.internal.missing = undefined;
		})
		.use(httpJwt({ internalKey: "missing", algorithm: "RS256" }));

	try {
		await handler(makeEvent("Bearer some.fake.token"), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 500);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should verify HS256 JWT when internalKey resolves to a plain string", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-ssm" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.hmacKey = secret;
		})
		.use(httpJwt({ internalKey: "hmacKey", algorithm: "HS256" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.jwt.sub, "user-ssm");
});

test("It should include clockTolerance in verify options when set", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-1" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({ secretKey: secret, algorithm: "HS256", clockTolerance: 60 }),
	);

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-1");
});

test("It should use options.algorithm over KMS keySpec when both are present", async (t) => {
	const { privateKey, publicKey } = await generateKeyPairAsync("rsa", {
		modulusLength: 2048,
	});

	const importedPrivate = await importPKCS8(
		privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
		"RS256",
	);

	const token = await new SignJWT({ sub: "user-override" })
		.setProtectedHeader({ alg: "RS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(importedPrivate);

	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.kmsKey = {
				publicKey: new Uint8Array(spkiDer),
				keySpec: "RSA_2048",
			};
		})
		.use(httpJwt({ internalKey: "kmsKey", algorithm: "RS256" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-override");
});

test("It should throw 500 when algorithm is incompatible with KMS keySpec", async (t) => {
	const { publicKey } = await generateKeyPairAsync("rsa", {
		modulusLength: 2048,
	});
	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy(() => {})
		.before((request) => {
			request.internal.kmsKey = {
				publicKey: new Uint8Array(spkiDer),
				keySpec: "RSA_2048",
			};
		})
		// User mispinned an HMAC algorithm for an RSA KMS key.
		.use(httpJwt({ internalKey: "kmsKey", algorithm: "HS256" }));

	try {
		await handler(makeEvent("Bearer abc.def.ghi"), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 500);
		strictEqual(e.cause.package, "@middy/http-jwt");
		ok(e.cause.data.includes("incompatible with KMS keySpec"));
	}
});

test("It should narrow algorithms to the keySpec-compatible subset", async (t) => {
	const { privateKey, publicKey } = await generateKeyPairAsync("rsa", {
		modulusLength: 2048,
	});

	const importedPrivate = await importPKCS8(
		privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
		"RS256",
	);

	const token = await new SignJWT({ sub: "user-narrow" })
		.setProtectedHeader({ alg: "RS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(importedPrivate);

	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.kmsKey = {
				publicKey: new Uint8Array(spkiDer),
				keySpec: "RSA_2048",
			};
		})
		// HS256 in the allowlist is filtered out because the keySpec is RSA.
		.use(httpJwt({ internalKey: "kmsKey", algorithm: ["RS256", "HS256"] }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-narrow");
});

test("It should verify JWT with KMS shape when keySpec is not in the algorithm map", async (t) => {
	const { privateKey, publicKey } = await generateKeyPairAsync("rsa", {
		modulusLength: 2048,
	});

	const importedPrivate = await importPKCS8(
		privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
		"RS256",
	);

	const token = await new SignJWT({ sub: "user-unknown-spec" })
		.setProtectedHeader({ alg: "RS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(importedPrivate);

	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.kmsKey = {
				publicKey: new Uint8Array(spkiDer),
				keySpec: "UNKNOWN_KEY_SPEC",
			};
		})
		.use(httpJwt({ internalKey: "kmsKey", algorithm: "RS256" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-unknown-spec");
});

test("It should verify RS256 JWT via internalKey (plain Uint8Array) with explicit algorithm", async (t) => {
	const { privateKey, publicKey } = await generateKeyPairAsync("rsa", {
		modulusLength: 2048,
	});

	const importedPrivate = await importPKCS8(
		privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
		"RS256",
	);

	const token = await new SignJWT({ sub: "user-bare-rsa" })
		.setProtectedHeader({ alg: "RS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(importedPrivate);

	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpJwt({ internalKey: "pubKey", algorithm: "RS256" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-bare-rsa");
});

test("It should verify HS256 JWT via internalKey (plain string) with explicit algorithm", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-hs256" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.hmacKey = secret;
		})
		.use(httpJwt({ internalKey: "hmacKey", algorithm: "HS256" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-hs256");
});

test("It should read JWT from a custom header when tokenHeaderName is set", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-hdr" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenHeaderName: "X-Id-Token",
		}),
	);

	const result = await handler(
		{ headers: { "X-Id-Token": token } },
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "user-hdr");
});

test("It should read JWT from a lowercased custom header when literal case is absent", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-hdr-lower" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenHeaderName: "X-Id-Token",
		}),
	);

	const result = await handler(
		{ headers: { "x-id-token": token } },
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "user-hdr-lower");
});

test("It should throw 401 when custom header is missing", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: "s",
			algorithm: "HS256",
			tokenHeaderName: "X-Id-Token",
		}),
	);

	try {
		await handler({ headers: {} }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should read JWT from a query parameter when tokenQueryStringName is set", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-qs" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenQueryStringName: "id_token",
		}),
	);

	const result = await handler(
		{ headers: {}, queryStringParameters: { id_token: token } },
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "user-qs");
});

test("It should throw 401 when tokenQueryStringName is missing", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: "s",
			algorithm: "HS256",
			tokenQueryStringName: "id_token",
		}),
	);

	try {
		await handler({ headers: {} }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should chain cookie -> header -> query, cookie wins when present", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const cookieToken = await new SignJWT({ sub: "from-cookie" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const headerToken = await new SignJWT({ sub: "from-header" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenCookieName: "access_token",
			tokenHeaderName: "Authorization",
			tokenQueryStringName: "id_token",
		}),
	);

	const result = await handler(
		{
			headers: {
				cookie: `access_token=${cookieToken}`,
				authorization: `Bearer ${headerToken}`,
			},
			queryStringParameters: { id_token: "ignored" },
		},
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "from-cookie");
});

test("It should fall through cookie -> header when cookie is absent", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "from-header" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenCookieName: "access_token",
			tokenHeaderName: "Authorization",
		}),
	);

	const result = await handler(
		{ headers: { authorization: `Bearer ${token}` } },
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "from-header");
});

test("It should fall through header -> query when header is absent", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "from-query" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenHeaderName: "Authorization",
			tokenQueryStringName: "id_token",
		}),
	);

	const result = await handler(
		{ headers: {}, queryStringParameters: { id_token: token } },
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "from-query");
});

test("It should throw 401 when event has no headers at all", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({ secretKey: "s", algorithm: "HS256" }),
	);

	try {
		await handler({}, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should fall through when Authorization header has wrong number of parts", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "from-query-malformed" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenHeaderName: "Authorization",
			tokenQueryStringName: "id_token",
		}),
	);

	const result = await handler(
		{
			headers: { authorization: "MalformedHeaderNoSpaces" },
			queryStringParameters: { id_token: token },
		},
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "from-query-malformed");
});

test("It should fall through to next source when Authorization scheme is not Bearer", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "from-query-fallback" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenHeaderName: "Authorization",
			tokenQueryStringName: "id_token",
		}),
	);

	const result = await handler(
		{
			headers: { authorization: "Basic dXNlcjpwYXNz" },
			queryStringParameters: { id_token: token },
		},
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "from-query-fallback");
});

// --- issuers (JWKS) path ---

test("issuers: single-issuer happy path", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/poolA";
	const jwksUri = nextJwksUri();
	const token = await signToken({
		privateKey,
		alg: "RS256",
		kid,
		iss,
		aud: "clientA",
	});

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri, audience: "clientA" } },
				algorithm: "RS256",
			}),
		);
		const result = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(result.jwt.iss, iss);
		strictEqual(result.jwt.aud, "clientA");
	} finally {
		fetchStub.restore();
	}
});

test("issuers: multi-issuer routes by iss to the right JWKS", async (t) => {
	const fixA = await jwksFixture({ kid: "a" });
	const fixB = await jwksFixture({ kid: "b" });
	const issA = "https://idp.example.com/poolA";
	const issB = "https://idp.example.com/poolB";
	const uriA = nextJwksUri();
	const uriB = nextJwksUri();
	const tokenA = await signToken({
		privateKey: fixA.privateKey,
		alg: "RS256",
		kid: "a",
		iss: issA,
		aud: "clientA",
	});
	const tokenB = await signToken({
		privateKey: fixB.privateKey,
		alg: "RS256",
		kid: "b",
		iss: issB,
		aud: "clientB",
	});

	const fetchStub = installFetch({
		[uriA]: jwksResponse({ keys: [fixA.jwk] }),
		[uriB]: jwksResponse({ keys: [fixB.jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: {
					[issA]: { jwksUri: uriA, audience: "clientA" },
					[issB]: { jwksUri: uriB, audience: "clientB" },
				},
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		const rA = await handler(
			{ headers: { authorization: `Bearer ${tokenA}` } },
			{ ...defaultContext },
		);
		const rB = await handler(
			{ headers: { authorization: `Bearer ${tokenB}` } },
			{ ...defaultContext },
		);
		strictEqual(rA.jwt.iss, issA);
		strictEqual(rB.jwt.iss, issB);
		const fetchedUrls = fetchStub.calls.map((c) => c.url);
		ok(fetchedUrls.includes(uriA));
		ok(fetchedUrls.includes(uriB));
	} finally {
		fetchStub.restore();
	}
});

test("issuers: token with iss not in map throws 401 Unknown issuer", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const issConfigured = "https://idp.example.com/poolA";
	const issToken = "https://idp.example.com/poolUnknown";
	const jwksUri = nextJwksUri();
	const token = await signToken({
		privateKey,
		alg: "RS256",
		kid,
		iss: issToken,
	});

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [issConfigured]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
			strictEqual(e.cause.data, "Unknown issuer");
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: token claiming iss A but signed by pool B fails verification", async (t) => {
	const fixA = await jwksFixture({ kid: "a" });
	const fixB = await jwksFixture({ kid: "b" });
	const issA = "https://idp.example.com/poolA";
	const issB = "https://idp.example.com/poolB";
	const uriA = nextJwksUri();
	const uriB = nextJwksUri();
	// Sign with pool B's private key but claim iss A.
	const token = await signToken({
		privateKey: fixB.privateKey,
		alg: "RS256",
		kid: "a", // claim kid from pool A
		iss: issA,
	});

	const fetchStub = installFetch({
		[uriA]: jwksResponse({ keys: [fixA.jwk] }),
		[uriB]: jwksResponse({ keys: [fixB.jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: {
					[issA]: { jwksUri: uriA },
					[issB]: { jwksUri: uriB },
				},
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: token with unknown kid throws 401", async (t) => {
	const { privateKey, jwk } = await jwksFixture({ kid: "real-kid" });
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({
		privateKey,
		alg: "RS256",
		kid: "ghost-kid",
		iss,
	});

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
			ok(e.cause.data.includes("No key in JWKS with kid"));
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: token claiming HS256 while pinned RS256 fails", async (t) => {
	const { jwk } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	// Sign an HS256 token (so its protected header says alg: HS256).
	const hsSecret = "shared-secret";
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: "HS256", kid: "test-kid" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer(iss)
		.sign(Buffer.from(hsSecret));

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: JWKS endpoint returns 500 surfaces as 401", async (t) => {
	const { privateKey, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });

	const fetchStub = installFetch({
		[jwksUri]: () => new Response("nope", { status: 500 }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: prefetch swallows fetch failures (no unhandled rejection)", async (t) => {
	const iss = "https://idp.example.com/failing";
	const jwksUri = nextJwksUri();

	const fetchStub = installFetch({
		[jwksUri]: () => new Response("nope", { status: 500 }),
	});
	try {
		httpJwt({
			issuers: { [iss]: { jwksUri } },
			algorithm: "RS256",
		});
		// Wait long enough for the warm-up fetch to complete and be swallowed.
		await new Promise((r) => setTimeout(r, 30));
		// If the catch handler had been missing, the runner would have emitted
		// an unhandledRejection here and aborted the test file.
		strictEqual(fetchStub.calls.length, 1);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: prefetch fires one fetch per entry at factory time", async (t) => {
	const fixA = await jwksFixture();
	const fixB = await jwksFixture();
	const uriA = nextJwksUri();
	const uriB = nextJwksUri();
	const issA = "https://idp.example.com/A";
	const issB = "https://idp.example.com/B";

	const fetchStub = installFetch({
		[uriA]: jwksResponse({ keys: [fixA.jwk] }),
		[uriB]: jwksResponse({ keys: [fixB.jwk] }),
	});
	try {
		httpJwt({
			issuers: {
				[issA]: { jwksUri: uriA },
				[issB]: { jwksUri: uriB },
			},
			algorithm: "RS256",
		});
		// give the warm-up promises a chance to fire
		await new Promise((r) => setTimeout(r, 30));
		const urls = fetchStub.calls.map((c) => c.url);
		strictEqual(urls.filter((u) => u === uriA).length, 1);
		strictEqual(urls.filter((u) => u === uriB).length, 1);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: disablePrefetch fires zero fetches at factory time", async (t) => {
	const { jwk } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		httpJwt({
			issuers: { [iss]: { jwksUri } },
			algorithm: "RS256",
			disablePrefetch: true,
		});
		await new Promise((r) => setTimeout(r, 30));
		strictEqual(fetchStub.calls.length, 0);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: two requests to the same issuer share the cached JWKS", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		const calls = fetchStub.calls.filter((c) => c.url === jwksUri).length;
		strictEqual(calls, 1);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: factory throws when both issuers and internalKey set", () => {
	try {
		realHttpJwt({
			internalKey: "k",
			issuers: { "https://idp.example.com": { jwksUri: "https://x/jwks" } },
			algorithm: "RS256",
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("issuers: factory throws when algorithm is missing", () => {
	try {
		httpJwt({
			issuers: { "https://idp.example.com": { jwksUri: "https://x/jwks" } },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("issuers: factory throws when algorithm is an empty array", () => {
	try {
		httpJwt({
			issuers: { "https://idp.example.com": { jwksUri: "https://x/jwks" } },
			algorithm: [],
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("issuers: factory throws when algorithm is 'none'", () => {
	try {
		httpJwt({
			issuers: { "https://idp.example.com": { jwksUri: "https://x/jwks" } },
			algorithm: "none",
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("issuers: audience array on entry accepts any listed aud", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({
		privateKey,
		alg: "RS256",
		kid,
		iss,
		aud: "client2",
	});

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: {
					[iss]: { jwksUri, audience: ["client1", "client2", "client3"] },
				},
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		const result = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(result.jwt.aud, "client2");
	} finally {
		fetchStub.restore();
	}
});

test("issuers: per-issuer algorithm override (ES256 entry alongside RS256 default)", async (t) => {
	const rsa = await jwksFixture({ kty: "rsa", alg: "RS256", kid: "rsa-1" });
	const ec = await jwksFixture({
		kty: "ec",
		alg: "ES256",
		kid: "ec-1",
		namedCurve: "P-256",
	});
	const issRsa = "https://idp.example.com/rsa";
	const issEc = "https://idp.example.com/ec";
	const uriRsa = nextJwksUri();
	const uriEc = nextJwksUri();
	const tokenRsa = await signToken({
		privateKey: rsa.privateKey,
		alg: "RS256",
		kid: "rsa-1",
		iss: issRsa,
	});
	const tokenEc = await signToken({
		privateKey: ec.privateKey,
		alg: "ES256",
		kid: "ec-1",
		iss: issEc,
	});

	const fetchStub = installFetch({
		[uriRsa]: jwksResponse({ keys: [rsa.jwk] }),
		[uriEc]: jwksResponse({ keys: [ec.jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: {
					[issRsa]: { jwksUri: uriRsa }, // inherits RS256
					[issEc]: { jwksUri: uriEc, algorithm: "ES256" }, // overrides
				},
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		const rRsa = await handler(
			{ headers: { authorization: `Bearer ${tokenRsa}` } },
			{ ...defaultContext },
		);
		const rEc = await handler(
			{ headers: { authorization: `Bearer ${tokenEc}` } },
			{ ...defaultContext },
		);
		strictEqual(rRsa.jwt.iss, issRsa);
		strictEqual(rEc.jwt.iss, issEc);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: per-issuer algorithm override of 'none' throws", () => {
	try {
		httpJwt({
			issuers: {
				"https://idp.example.com/x": {
					jwksUri: "https://x/jwks",
					algorithm: "none",
				},
			},
			algorithm: "RS256",
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("issuers: array algorithm accepts a token with any listed alg, rejects others", async (t) => {
	const rsa = await jwksFixture({ kty: "rsa", alg: "RS256", kid: "rsa-1" });
	const ec = await jwksFixture({
		kty: "ec",
		alg: "ES256",
		kid: "ec-1",
		namedCurve: "P-256",
	});
	const iss = "https://idp.example.com/mixed";
	const jwksUri = nextJwksUri();
	const tokenRsa = await signToken({
		privateKey: rsa.privateKey,
		alg: "RS256",
		kid: "rsa-1",
		iss,
	});
	const tokenEc = await signToken({
		privateKey: ec.privateKey,
		alg: "ES256",
		kid: "ec-1",
		iss,
	});
	const tokenHs = await new SignJWT({})
		.setProtectedHeader({ alg: "HS256", kid: "rsa-1" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer(iss)
		.sign(Buffer.from("shared"));

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [rsa.jwk, ec.jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri, algorithm: ["RS256", "ES256"] } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		const rRsa = await handler(
			{ headers: { authorization: `Bearer ${tokenRsa}` } },
			{ ...defaultContext },
		);
		const rEc = await handler(
			{ headers: { authorization: `Bearer ${tokenEc}` } },
			{ ...defaultContext },
		);
		strictEqual(rRsa.jwt.iss, iss);
		strictEqual(rEc.jwt.iss, iss);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${tokenHs}` } },
				{ ...defaultContext },
			);
			ok(false, "expected HS256 to be rejected");
		} catch (e) {
			strictEqual(e.statusCode, 401);
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: JWK with alg not in configured allowlist throws 401", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture({ alg: "RS256" });
	// Replace the JWK's alg with something not in our allowlist.
	const poisonedJwk = { ...jwk, alg: "RS512" };
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [poisonedJwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
			ok(e.cause.data.includes("not in configured allowlist"));
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: JWK without alg + single-alg allowlist verifies", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture({ alg: "RS256" });
	const stripped = { ...jwk };
	delete stripped.alg;
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [stripped] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		const result = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(result.jwt.iss, iss);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: JWK without alg + multi-alg allowlist rejects as ambiguous", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture({ alg: "RS256" });
	const stripped = { ...jwk };
	delete stripped.alg;
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [stripped] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri, algorithm: ["RS256", "ES256"] } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
			ok(e.cause.data.includes("cannot disambiguate"));
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: JWKS document without keys array throws 401", async (t) => {
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: "RS256", kid: "anything" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer(iss)
		.sign(
			(await generateKeyPairAsync("rsa", { modulusLength: 2048 })).privateKey,
		);

	const fetchStub = installFetch({
		[jwksUri]: () =>
			new Response(JSON.stringify({ not_keys: [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
			ok(e.cause.data.includes("JWKS fetch failed"));
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: malformed JWK material surfaces as 401 (importJWK failure)", async (t) => {
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: "RS256", kid: "bad-jwk" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer(iss)
		.sign(
			(await generateKeyPairAsync("rsa", { modulusLength: 2048 })).privateKey,
		);

	// JWK with the right kid/alg but an unsupported kty.
	const badJwk = {
		kty: "UNSUPPORTED",
		alg: "RS256",
		kid: "bad-jwk",
		use: "sig",
	};

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [badJwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: clockTolerance is forwarded to jwtVerify", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	// Token expired 1 second ago.
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: "RS256", kid })
		.setIssuedAt()
		.setExpirationTime("-1s")
		.setIssuer(iss)
		.sign(privateKey);

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				clockTolerance: 5,
				disablePrefetch: true,
			}),
		);
		const result = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(result.jwt.iss, iss);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: malformed token (not a JWT) throws 401 with cause.data", async (t) => {
	const { jwk } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: "Bearer not.a.jwt" } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
		}
	} finally {
		fetchStub.restore();
	}
});

test("setToContext: false (default) writes only to internal, not context", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-internal-only" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const seen = {};
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.hmacKey = secret;
		})
		.use(realHttpJwt({ internalKey: "hmacKey", algorithm: "HS256" }))
		.before((request) => {
			seen.internal = request.internal.jwt?.sub;
			seen.context = request.context.jwt?.sub;
		});

	const result = await handler(
		{ headers: { authorization: `Bearer ${token}` } },
		{ ...defaultContext },
	);

	strictEqual(seen.internal, "user-internal-only");
	strictEqual(seen.context, undefined);
	strictEqual(result.jwt, undefined);
});

test("setToContext: true writes to both internal and context", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-both" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.hmacKey = secret;
		})
		.use(
			realHttpJwt({
				internalKey: "hmacKey",
				algorithm: "HS256",
				setToContext: true,
			}),
		);

	const result = await handler(
		{ headers: { authorization: `Bearer ${token}` } },
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "user-both");
});

test("httpJwtValidateOptions accepts valid options and rejects typos", () => {
	httpJwtValidateOptions({ internalKey: "k", algorithm: "HS256" });
	httpJwtValidateOptions({
		internalKey: "k",
		algorithm: "HS256",
		requireExp: true,
		maxTokenAge: "1h",
	});
	httpJwtValidateOptions({
		internalKey: "k",
		algorithm: "HS256",
		maxTokenAge: 3600,
	});
	httpJwtValidateOptions({});
	try {
		httpJwtValidateOptions({ internlKey: "k" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("httpJwtValidateOptions accepts the issuers shape", () => {
	httpJwtValidateOptions({
		issuers: {
			"https://idp.example.com": {
				jwksUri: "https://idp.example.com/.well-known/jwks.json",
				audience: "client",
				algorithm: ["RS256", "ES256"],
			},
		},
		algorithm: "RS256",
		cacheExpiry: 1000,
		cooldownDuration: 100,
		disablePrefetch: true,
	});
	try {
		httpJwtValidateOptions({
			issuers: { "https://x.example": { audience: "c" } }, // missing jwksUri
			algorithm: "RS256",
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should accept Authorization header delivered as an array (multiValueHeaders / repeated headers)", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-array-hdr" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({ secretKey: secret, algorithm: "HS256" }),
	);

	const result = await handler(
		{ headers: { authorization: [`Bearer ${token}`, "Bearer other"] } },
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "user-array-hdr");
});

test("It should strip RFC 6265 surrounding double-quotes from a cookie value", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-quoted-cookie" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenCookieName: "access_token",
		}),
	);

	const result = await handler(
		{ headers: { cookie: `access_token="${token}"; other=val` } },
		{ ...defaultContext },
	);

	strictEqual(result.jwt.sub, "user-quoted-cookie");
});

test("It should accept a token without exp by default", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	// No setExpirationTime: token has no exp claim.
	const token = await new SignJWT({ sub: "user-no-exp" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({ secretKey: secret, algorithm: "HS256" }),
	);

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.jwt.sub, "user-no-exp");
});

test("It should reject a token without exp when requireExp is set", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-no-exp" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.sign(Buffer.from(secret));

	const handler = middy(() => {}).use(
		httpJwt({ secretKey: secret, algorithm: "HS256", requireExp: true }),
	);

	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should accept a token with exp when requireExp is set", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-has-exp" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context).use(
		httpJwt({ secretKey: secret, algorithm: "HS256", requireExp: true }),
	);

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.jwt.sub, "user-has-exp");
});

test("It should reject a token older than maxTokenAge", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	// Issued 2 hours ago, no exp claim.
	const token = await new SignJWT({ sub: "user-stale" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
		.sign(Buffer.from(secret));

	const handler = middy(() => {}).use(
		httpJwt({ secretKey: secret, algorithm: "HS256", maxTokenAge: "1h" }),
	);

	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("issuers: requireExp rejects a token without exp", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	// No setExpirationTime: token has no exp claim.
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: "RS256", kid })
		.setIssuedAt()
		.setIssuer(iss)
		.sign(privateKey);

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				requireExp: true,
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: maxTokenAge rejects a stale token", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	// Issued 2 hours ago, no exp claim.
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: "RS256", kid })
		.setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
		.setIssuer(iss)
		.sign(privateKey);

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				maxTokenAge: "1h",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				{ ...defaultContext },
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.package, "@middy/http-jwt");
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: requireExp accepts a token with exp", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });

	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				requireExp: true,
				disablePrefetch: true,
			}),
		);
		const result = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(result.jwt.iss, iss);
	} finally {
		fetchStub.restore();
	}
});

test("It should resolve a hyphenated internalKey without a spurious 500", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-hyphen-key" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal["jwt-key"] = secret;
		})
		.use(httpJwt({ internalKey: "jwt-key", algorithm: "HS256" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.jwt.sub, "user-hyphen-key");
});

test("It should resolve a dotted nested internalKey without a spurious 500", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-dotted-key" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.kms = { publicKey: secret };
		})
		.use(httpJwt({ internalKey: "kms.publicKey", algorithm: "HS256" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.jwt.sub, "user-dotted-key");
});

// --- KMS keySpec / algorithm compatibility matrix ---

// Builds a KMS-shape internalKey { publicKey, keySpec } verification handler and
// returns the verified payload.sub. If the configured `alg` is filtered out of
// the keySpec allowlist (a mutated/empty allowlist), usableAlgs becomes [] and
// the middleware throws 500 instead of verifying.
const verifyKmsAlg = async ({ keySpec, alg, kty, curve }) => {
	const { privateKey, publicKey } = await generateKeyPairAsync(
		kty,
		kty === "rsa"
			? { modulusLength: 2048 }
			: kty === "ec"
				? { namedCurve: curve }
				: {},
	);
	const importedPrivate = await importPKCS8(
		privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
		alg,
	);
	const token = await new SignJWT({ sub: `kms-${alg}` })
		.setProtectedHeader({ alg })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(importedPrivate);
	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.kmsKey = {
				publicKey: new Uint8Array(spkiDer),
				keySpec,
			};
		})
		.use(httpJwt({ internalKey: "kmsKey", algorithm: [alg] }));
	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	return result.jwt.sub;
};

for (const { keySpec, alg, kty, curve } of [
	{ keySpec: "RSA_2048", alg: "RS256", kty: "rsa" },
	{ keySpec: "RSA_2048", alg: "RS384", kty: "rsa" },
	{ keySpec: "RSA_2048", alg: "RS512", kty: "rsa" },
	{ keySpec: "RSA_2048", alg: "PS256", kty: "rsa" },
	{ keySpec: "RSA_2048", alg: "PS384", kty: "rsa" },
	{ keySpec: "RSA_2048", alg: "PS512", kty: "rsa" },
	{ keySpec: "RSA_3072", alg: "RS256", kty: "rsa" },
	{ keySpec: "RSA_3072", alg: "RS384", kty: "rsa" },
	{ keySpec: "RSA_3072", alg: "RS512", kty: "rsa" },
	{ keySpec: "RSA_3072", alg: "PS256", kty: "rsa" },
	{ keySpec: "RSA_3072", alg: "PS384", kty: "rsa" },
	{ keySpec: "RSA_3072", alg: "PS512", kty: "rsa" },
	{ keySpec: "RSA_4096", alg: "RS256", kty: "rsa" },
	{ keySpec: "RSA_4096", alg: "RS384", kty: "rsa" },
	{ keySpec: "RSA_4096", alg: "RS512", kty: "rsa" },
	{ keySpec: "RSA_4096", alg: "PS256", kty: "rsa" },
	{ keySpec: "RSA_4096", alg: "PS384", kty: "rsa" },
	{ keySpec: "RSA_4096", alg: "PS512", kty: "rsa" },
	{ keySpec: "ECC_NIST_P256", alg: "ES256", kty: "ec", curve: "P-256" },
	{ keySpec: "ECC_NIST_P384", alg: "ES384", kty: "ec", curve: "P-384" },
	{ keySpec: "ECC_NIST_P521", alg: "ES512", kty: "ec", curve: "P-521" },
	{ keySpec: "ECC_NIST_ED25519", alg: "EdDSA", kty: "ed25519" },
]) {
	test(`KMS keySpec ${keySpec} accepts ${alg}`, async (t) => {
		const sub = await verifyKmsAlg({ keySpec, alg, kty, curve });
		strictEqual(sub, `kms-${alg}`);
	});
}

// Each RSA keySpec must NOT accept an EC/ECDSA alg, and each EC keySpec must NOT
// accept an RSA alg: pinning a cross-family alg yields an empty intersection ->
// 500. This pins that the allowlists do not over-include foreign algs (kills
// ArrayDeclaration->[] equivalence with a permissive superset).
for (const keySpec of ["RSA_2048", "RSA_3072", "RSA_4096"]) {
	test(`KMS keySpec ${keySpec} rejects ES256 as incompatible`, async (t) => {
		const { publicKey } = await generateKeyPairAsync("rsa", {
			modulusLength: 2048,
		});
		const spkiDer = publicKey.export({ type: "spki", format: "der" });
		const handler = middy(() => {})
			.before((request) => {
				request.internal.kmsKey = {
					publicKey: new Uint8Array(spkiDer),
					keySpec,
				};
			})
			.use(httpJwt({ internalKey: "kmsKey", algorithm: "ES256" }));
		try {
			await handler(makeEvent("Bearer a.b.c"), defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 500);
			strictEqual(e.message, "Internal Server Error");
			ok(e.cause.data.includes("incompatible with KMS keySpec"));
		}
	});
}

for (const { keySpec } of [
	{ keySpec: "ECC_NIST_P256" },
	{ keySpec: "ECC_NIST_P384" },
	{ keySpec: "ECC_NIST_P521" },
	{ keySpec: "ECC_NIST_ED25519" },
]) {
	test(`KMS keySpec ${keySpec} rejects RS256 as incompatible`, async (t) => {
		const { publicKey } = await generateKeyPairAsync("ec", {
			namedCurve: "P-256",
		});
		const spkiDer = publicKey.export({ type: "spki", format: "der" });
		const handler = middy(() => {})
			.before((request) => {
				request.internal.kmsKey = {
					publicKey: new Uint8Array(spkiDer),
					keySpec,
				};
			})
			.use(httpJwt({ internalKey: "kmsKey", algorithm: "RS256" }));
		try {
			await handler(makeEvent("Bearer a.b.c"), defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 500);
			ok(e.cause.data.includes("incompatible with KMS keySpec"));
		}
	});
}

// --- option schema validation (httpJwtValidateOptions) ---

// Asserts the option validator throws a TypeError whose message exactly matches
// the schema-derived constraint message. Matching the exact message (not just
// the TypeError shape) distinguishes the real schema from a blanked/empty-type
// schema, whose validator throws an "Invalid schema"/"Unknown schema type"
// message instead.
const expectInvalidOption = (opts, expectedMessage) => {
	try {
		httpJwtValidateOptions(opts);
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-jwt");
		strictEqual(e.message, expectedMessage);
	}
};

test("httpJwtValidateOptions rejects non-string tokenCookieName", () => {
	expectInvalidOption(
		{ tokenCookieName: 123 },
		"Option 'tokenCookieName' must be string",
	);
});

test("httpJwtValidateOptions rejects non-string tokenHeaderName", () => {
	expectInvalidOption(
		{ tokenHeaderName: 123 },
		"Option 'tokenHeaderName' must be string",
	);
});

test("httpJwtValidateOptions rejects non-string tokenQueryStringName", () => {
	expectInvalidOption(
		{ tokenQueryStringName: 123 },
		"Option 'tokenQueryStringName' must be string",
	);
});

test("httpJwtValidateOptions rejects non-number clockTolerance", () => {
	expectInvalidOption(
		{ clockTolerance: "60" },
		"Option 'clockTolerance' must be number",
	);
});

test("httpJwtValidateOptions rejects negative clockTolerance", () => {
	expectInvalidOption(
		{ clockTolerance: -1 },
		"Option 'clockTolerance' must be >= 0",
	);
});

test("httpJwtValidateOptions rejects non-string payloadKey", () => {
	expectInvalidOption(
		{ payloadKey: 123 },
		"Option 'payloadKey' must be string",
	);
});

test("httpJwtValidateOptions rejects non-boolean setToContext", () => {
	expectInvalidOption(
		{ setToContext: "yes" },
		"Option 'setToContext' must be boolean",
	);
});

test("httpJwtValidateOptions rejects unknown property inside an issuers entry", () => {
	expectInvalidOption(
		{
			issuers: {
				"https://idp.example.com": {
					jwksUri: "https://idp.example.com/jwks",
					unknownProp: "x",
				},
			},
			algorithm: "RS256",
		},
		"Unknown option 'issuers.https://idp.example.com.unknownProp'",
	);
});

// --- cookie reader edge cases ---

test("readCookieValue: undefined event/headers throws 401, not a TypeError", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: "s",
			algorithm: "HS256",
			tokenCookieName: "access_token",
		}),
	);
	try {
		// event is an empty object: event.headers is undefined.
		await handler({}, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

// The quoted-cookie guard strips a leading+trailing double-quote pair via
// slice(1,-1). These tests build cookie values shaped `c1 + token + c2` so that
// slicing yields exactly the valid token. The middleware must strip ONLY when
// the value both starts AND ends with a quote; any mutated guard that strips a
// non-quoted-pair value produces the valid token (200) where the real code
// leaves the wrapper chars in place (401), and vice-versa.
const buildToken = async (sub) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));
	return { secret, token };
};

const cookieHandler = (secret) =>
	middy((event, context) => context).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenCookieName: "access_token",
		}),
	);

const expect401 = async (handler, cookie) => {
	try {
		await handler({ headers: { cookie } }, { ...defaultContext });
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		return e;
	}
};

test("Cookie guard: value with non-quote wrappers is NOT stripped (xTx -> 401)", async (t) => {
	// xTx: starts/ends with non-quote. Real: no strip -> invalid (401). Mutant
	// flipping the first && to || would strip on length alone -> token T (200).
	const { secret, token } = await buildToken("c-xTx");
	await expect401(cookieHandler(secret), `access_token=x${token}x`);
});

test('Cookie guard: leading-quote-only value is NOT stripped ("Tx -> 401)', async (t) => {
	// "Tx: starts with quote, ends with non-quote. Real: no strip (401).
	// Mutants that drop the endsWith requirement would strip -> T (200).
	const { secret, token } = await buildToken("c-qTx");
	await expect401(cookieHandler(secret), `access_token="${token}x`);
});

test('Cookie guard: trailing-quote-only value is NOT stripped (xT" -> 401)', async (t) => {
	// xT": ends with quote, starts with non-quote. Real: no strip (401).
	// Mutants that drop the startsWith requirement would strip -> T (200).
	const { secret, token } = await buildToken("c-xTq");
	await expect401(cookieHandler(secret), `access_token=x${token}"`);
});

test("Cookie guard: a quoted-pair value IS stripped to the valid token (200)", async (t) => {
	// "T": both quotes present. Real strips -> valid token (200). Any mutant
	// that fails to strip a true quoted pair would leave the quotes and 401.
	const { secret, token } = await buildToken("c-qTq");
	const result = await cookieHandler(secret)(
		{ headers: { cookie: `access_token="${token}"` } },
		{ ...defaultContext },
	);
	strictEqual(result.jwt.sub, "c-qTq");
});

test("Cookie guard: a lone-quote (length 1) value is returned verbatim, not sliced to empty", async (t) => {
	// A single '"' has length 1: the length>=2 guard must keep it false so the
	// value is returned verbatim ('"', truthy) and reaches jwtVerify -> a verify
	// error. A mutant forcing length>=2 true would slice it to "" (falsy),
	// reporting "No token found" instead. Distinguish via cause.data.
	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: "s",
			algorithm: "HS256",
			tokenCookieName: "access_token",
		}),
	);
	const e = await expect401(handler, 'access_token="');
	ok(e.cause.data !== "No token found in configured sources");
});

test('Cookie guard: an empty quoted-pair "" (length 2) is sliced to empty -> No token found', async (t) => {
	// '""' is length 2 and a quoted pair: real slices to "" (falsy), so parsing
	// reports "No token found". A mutant changing >= to > would treat length 2
	// as not-a-pair, returning '""' verbatim (truthy) -> a jwtVerify error with
	// different cause.data. Pin the exact boundary via cause.data.
	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: "s",
			algorithm: "HS256",
			tokenCookieName: "access_token",
		}),
	);
	const e = await expect401(handler, 'access_token=""');
	strictEqual(e.cause.data, "No token found in configured sources");
});

// --- factory-time validation error messages ---

test("Factory: no key source error message", () => {
	try {
		realHttpJwt({});
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(
			e.message,
			"No key source configured: set internalKey or issuers",
		);
	}
});

test("Factory: both key sources error message", () => {
	try {
		realHttpJwt({
			internalKey: "k",
			issuers: { "https://idp.example.com": { jwksUri: "https://x/jwks" } },
			algorithm: "RS256",
		});
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.message, "Set exactly one of internalKey, issuers");
	}
});

test("Factory: internalKey without algorithm error message", () => {
	try {
		realHttpJwt({ internalKey: "k" });
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.message, "algorithm is required when using internalKey");
	}
});

test("Factory: issuers without algorithm error message", () => {
	try {
		realHttpJwt({
			issuers: { "https://idp.example.com": { jwksUri: "https://x/jwks" } },
		});
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.message, "algorithm is required when using issuers");
	}
});

test("Factory: empty top-level algorithm array error message", () => {
	try {
		realHttpJwt({ internalKey: "k", algorithm: [] });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("algorithm list is empty"));
		ok(e.message.includes("options.algorithm"));
	}
});

test("Factory: top-level algorithm 'none' error message and label", () => {
	try {
		realHttpJwt({ internalKey: "k", algorithm: "none" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("'none' is not allowed"));
		ok(e.message.includes("options.algorithm"));
	}
});

test("Factory: per-issuer algorithm 'none' uses the issuers label", () => {
	const iss = "https://idp.example.com/x";
	try {
		realHttpJwt({
			issuers: { [iss]: { jwksUri: "https://x/jwks", algorithm: "none" } },
			algorithm: "RS256",
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("'none' is not allowed"));
		ok(e.message.includes(`issuers['${iss}'].algorithm`));
	}
});

// --- runtime error message / cause.data assertions ---

test("It should reject an Authorization header with three space-separated parts", async (t) => {
	// `Bearer <token> junk` has 3 parts. The default Authorization source must
	// require EXACTLY two parts; a mutant dropping the length!==2 guard would
	// return parts[1] (the valid token) and verify it (200). Real -> 401.
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-3parts" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));
	const handler = middy(() => {}).use(
		httpJwt({ secretKey: secret, algorithm: "HS256" }),
	);
	try {
		await handler(makeEvent(`Bearer ${token} junk`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.data, "No token found in configured sources");
	}
});

// --- null event passed to each token source (optional chaining) ---

test("Cookie source: a null event yields a clean 401, not a TypeError", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: "s",
			algorithm: "HS256",
			tokenCookieName: "access_token",
		}),
	);
	try {
		await handler(null, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.data, "No token found in configured sources");
	}
});

test("Header source: a null event yields a clean 401, not a TypeError", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({ secretKey: "s", algorithm: "HS256", tokenHeaderName: "X-Tok" }),
	);
	try {
		await handler(null, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.data, "No token found in configured sources");
	}
});

test("Query source: a null event yields a clean 401, not a TypeError", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: "s",
			algorithm: "HS256",
			tokenQueryStringName: "q",
		}),
	);
	try {
		await handler(null, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.data, "No token found in configured sources");
	}
});

test("internalKey: null keyData fails via Buffer.from, not a publicKey access on null", async (t) => {
	// keyData resolves to null (not undefined, so the 500 guard does not fire).
	// `keyData?.publicKey` must short-circuit; without the optional chaining the
	// error would be "Cannot read properties of null (reading 'publicKey')".
	const handler = middy(() => {})
		.before((request) => {
			request.internal.k = null;
		})
		.use(httpJwt({ internalKey: "k", algorithm: "HS256" }));
	try {
		await handler(makeEvent("Bearer a.b.c"), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(!e.message.includes("publicKey"));
	}
});

test("It should report 'No token found in configured sources' when token absent", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({ secretKey: "s", algorithm: "HS256" }),
	);
	try {
		await handler({ headers: {} }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.message, "Unauthorized");
		strictEqual(e.cause.data, "No token found in configured sources");
	}
});

test("It should report the undefined-internalKey 500 message and cause.data", async (t) => {
	const handler = middy(() => {})
		.before((request) => {
			request.internal.missing = undefined;
		})
		.use(httpJwt({ internalKey: "missing", algorithm: "RS256" }));
	try {
		await handler(makeEvent("Bearer a.b.c"), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 500);
		strictEqual(e.message, "Internal Server Error");
		strictEqual(e.cause.data, "internalKey 'missing' resolved to undefined");
	}
});

test("issuers: malformed-token 401 message and cause.data", async (t) => {
	const { jwk } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: "Bearer not.a.jwt" } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.message, "Unauthorized");
			ok(e.cause.data.startsWith("Malformed token: "));
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: unknown-issuer message text", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const issConfigured = "https://idp.example.com/poolA";
	const jwksUri = nextJwksUri();
	const token = await signToken({
		privateKey,
		alg: "RS256",
		kid,
		iss: "https://idp.example.com/other",
	});
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [issConfigured]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.message, "Unauthorized");
			strictEqual(e.cause.data, "Unknown issuer");
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: JWKS-fetch-failed surfaces 'Unauthorized' message", async (t) => {
	const { privateKey, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });
	const fetchStub = installFetch({
		[jwksUri]: () => new Response("nope", { status: 503 }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.message, "Unauthorized");
			ok(e.cause.data.includes("JWKS fetch failed: HTTP 503"));
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: no-key-in-JWKS message text", async (t) => {
	const { privateKey, jwk } = await jwksFixture({ kid: "real-kid" });
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({
		privateKey,
		alg: "RS256",
		kid: "ghost-kid",
		iss,
	});
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.message, "Unauthorized");
			strictEqual(e.cause.data, "No key in JWKS with kid 'ghost-kid'");
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: invalid-JWKS-document message text (missing keys array)", async (t) => {
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: "RS256", kid: "anything" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer(iss)
		.sign(
			(await generateKeyPairAsync("rsa", { modulusLength: 2048 })).privateKey,
		);
	const fetchStub = installFetch({
		[jwksUri]: () =>
			new Response(JSON.stringify({ not_keys: [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			ok(
				e.cause.data.includes(
					"JWKS fetch failed: Invalid JWKS document: missing keys array",
				),
			);
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: JWK-alg-not-in-allowlist message text", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture({ alg: "RS256" });
	const poisonedJwk = { ...jwk, alg: "RS512" };
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [poisonedJwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.message, "Unauthorized");
			strictEqual(e.cause.data, "JWK alg 'RS512' not in configured allowlist");
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: ambiguous-alg message text", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture({ alg: "RS256" });
	const stripped = { ...jwk };
	delete stripped.alg;
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [stripped] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri, algorithm: ["RS256", "ES256"] } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.message, "Unauthorized");
			strictEqual(
				e.cause.data,
				"JWK omits 'alg' and multiple algorithms configured; cannot disambiguate",
			);
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: JWK-import-failed message and cause.data", async (t) => {
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: "RS256", kid: "bad-jwk" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer(iss)
		.sign(
			(await generateKeyPairAsync("rsa", { modulusLength: 2048 })).privateKey,
		);
	const badJwk = {
		kty: "UNSUPPORTED",
		alg: "RS256",
		kid: "bad-jwk",
		use: "sig",
	};
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [badJwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.message, "Unauthorized");
			ok(e.cause.data.startsWith("JWK import failed: "));
		}
	} finally {
		fetchStub.restore();
	}
});

test("internalKey: final verify-failure 401 carries the 'Unauthorized' message", async (t) => {
	const handler = middy(() => {}).use(
		httpJwt({ secretKey: "correct-secret", algorithm: "HS256" }),
	);
	const token = await new SignJWT({ sub: "x" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from("wrong-secret"));
	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.message, "Unauthorized");
	}
});

// --- audience / issuer / maxTokenAge passthrough guards ---

test("It should reject a token whose aud is not the configured audience (internalKey path)", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-1", aud: "wrong-aud" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));
	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			audience: "https://api.example.com",
		}),
	);
	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
	}
});

test("It should accept any aud when no audience is configured (internalKey path)", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-anyaud", aud: "anything" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));
	const handler = middy((event, context) => context).use(
		httpJwt({ secretKey: secret, algorithm: "HS256" }),
	);
	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-anyaud");
});

test("It should accept any iss when no issuer is configured (internalKey path)", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-anyiss" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer("some-issuer")
		.sign(Buffer.from(secret));
	const handler = middy((event, context) => context).use(
		httpJwt({ secretKey: secret, algorithm: "HS256" }),
	);
	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-anyiss");
});

test("It should reject an expired token within default (zero) clockTolerance", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	// expired 30s ago, default clockTolerance 0 -> must reject.
	const token = await new SignJWT({ sub: "user-exp" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("-30s")
		.sign(Buffer.from(secret));
	const handler = middy(() => {}).use(
		httpJwt({ secretKey: secret, algorithm: "HS256" }),
	);
	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
	}
});

test("It should accept an expired token within a generous clockTolerance (internalKey path)", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-tol" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("-30s")
		.sign(Buffer.from(secret));
	const handler = middy((event, context) => context).use(
		httpJwt({ secretKey: secret, algorithm: "HS256", clockTolerance: 120 }),
	);
	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-tol");
});

test("It should forward maxTokenAge on the internalKey path (rejects stale token)", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-stale-ik" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
		.sign(Buffer.from(secret));
	const handler = middy(() => {}).use(
		httpJwt({ secretKey: secret, algorithm: "HS256", maxTokenAge: "1h" }),
	);
	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
	}
});

// --- issuers path: audience guard + clockTolerance guard ---

test("issuers: rejects token whose aud is not the per-issuer audience", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({
		privateKey,
		alg: "RS256",
		kid,
		iss,
		aud: "wrong-client",
	});
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri, audience: "right-client" } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: accepts any aud when no per-issuer audience configured", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({
		privateKey,
		alg: "RS256",
		kid,
		iss,
		aud: "any-client",
	});
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		const result = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(result.jwt.aud, "any-client");
	} finally {
		fetchStub.restore();
	}
});

test("issuers: an expired token is rejected when clockTolerance is unset (0)", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: "RS256", kid })
		.setIssuedAt()
		.setExpirationTime("-60s")
		.setIssuer(iss)
		.sign(privateKey);
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
		}
	} finally {
		fetchStub.restore();
	}
});

test("issuers: pins issuer to the token's iss (cross-issuer aud reuse rejected)", async (t) => {
	// Two issuers sharing the same JWKS+kid. A token claiming issA must verify
	// with issuer=issA; if verifyOptions dropped the issuer pin, a token whose
	// iss does not match the route entry could slip through. Here we sign with
	// iss=issA and route via issA; verification must succeed, proving issuer is
	// set to payload.iss (not omitted).
	const { privateKey, jwk, kid } = await jwksFixture();
	const issA = "https://idp.example.com/poolA";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss: issA });
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [issA]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		const result = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(result.jwt.iss, issA);
	} finally {
		fetchStub.restore();
	}
});

// --- custom source suppresses default Authorization source ---

test("It should NOT fall back to the Authorization header when a custom source is configured", async (t) => {
	const secret = "super-secret-key-for-testing-1234";
	const token = await new SignJWT({ sub: "user-auth" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));
	// Only a cookie source is configured; a valid Bearer token in the
	// Authorization header must be ignored (no default source added).
	const handler = middy(() => {}).use(
		httpJwt({
			secretKey: secret,
			algorithm: "HS256",
			tokenCookieName: "access_token",
		}),
	);
	try {
		await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			defaultContext,
		);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.data, "No token found in configured sources");
	}
});

// --- key-source exclusivity counting (filter v !== undefined) ---

test("Factory: counts only defined key sources (issuers alone is valid)", () => {
	// internalKey undefined, issuers defined -> exactly one source -> no throw.
	const m = realHttpJwt({
		issuers: { "https://idp.example.com": { jwksUri: "https://x/jwks" } },
		algorithm: "RS256",
		disablePrefetch: true,
	});
	ok(typeof m.before === "function");
});

// --- JWKS cooldown + cache + dedup behaviors ---

test("issuers: a missing kid triggers exactly one rotation refetch then 401", async (t) => {
	// First fetch returns a JWKS without the requested kid. The rotation path
	// refetches (subject to cooldown); since cooldown blocks an immediate second
	// network call, the cached doc is reused and the kid is still absent -> 401.
	const { privateKey, jwk } = await jwksFixture({ kid: "present-kid" });
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({
		privateKey,
		alg: "RS256",
		kid: "absent-kid",
		iss,
	});
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy(() => {}).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		try {
			await handler(
				{ headers: { authorization: `Bearer ${token}` } },
				defaultContext,
			);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 401);
			strictEqual(e.cause.data, "No key in JWKS with kid 'absent-kid'");
		}
		// Exactly one network fetch: cooldown suppresses the rotation refetch.
		strictEqual(fetchStub.calls.filter((c) => c.url === jwksUri).length, 1);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: rotation refetch finds a newly-added kid after cooldown elapses", async (t) => {
	// Start with an empty key set; first getJwk misses. With cooldownDuration 0,
	// the rotation refetch is allowed and now returns the rotated key, so the
	// token verifies. This pins both the !jwk refetch and the re-lookup find().
	const { privateKey, jwk, kid } = await jwksFixture({ kid: "rotated-kid" });
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });
	let fetchN = 0;
	const fetchStub = installFetch({
		// First fetch serves an empty key set; the rotation refetch (cooldown 0)
		// serves the rotated key.
		[jwksUri]: () => {
			fetchN += 1;
			return new Response(JSON.stringify({ keys: fetchN >= 2 ? [jwk] : [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		},
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				cooldownDuration: 0,
				disablePrefetch: true,
			}),
		);
		const result = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(result.jwt.iss, iss);
		// two fetches: initial + rotation refetch.
		ok(fetchStub.calls.filter((c) => c.url === jwksUri).length >= 2);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: stale cache past cacheExpiry triggers a refetch", async (t) => {
	// cacheExpiry 0 means any cached doc is immediately stale, so each request
	// refetches. Two requests -> at least two network fetches. Pins that
	// cacheExpiry is propagated into the resolver and governs staleness.
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				cacheExpiry: 0,
				cooldownDuration: 0,
				disablePrefetch: true,
			}),
		);
		await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		// Ensure the clock advances so now - cacheTime > 0 (cacheMaxAge === 0).
		await new Promise((r) => setTimeout(r, 5));
		await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		ok(fetchStub.calls.filter((c) => c.url === jwksUri).length >= 2);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: fresh cache within cacheExpiry is reused (default cooldown/cache)", async (t) => {
	// Default cacheMaxAge (600s) and cooldown (30s): a second request within the
	// window reuses the cached doc, so only one network fetch occurs.
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(fetchStub.calls.filter((c) => c.url === jwksUri).length, 1);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: concurrent first requests share a single in-flight JWKS fetch", async (t) => {
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });
	let resolveFetch;
	const gate = new Promise((r) => {
		resolveFetch = r;
	});
	let fetchCount = 0;
	const original = globalThis.fetch;
	globalThis.fetch = async (input) => {
		const url = typeof input === "string" ? input : input.url;
		if (url === jwksUri) {
			fetchCount += 1;
			await gate;
			return new Response(JSON.stringify({ keys: [jwk] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
		return new Response("not found", { status: 404 });
	};
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		// Both handlers start synchronously; the first getJwk sets the shared
		// inflight promise and the second reuses it, so fetchCount is fixed before
		// any await resolves. Resolve the gate immediately to keep the window in
		// which globalThis.fetch is replaced as short as possible.
		const p1 = handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		const p2 = handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		resolveFetch();
		const [r1, r2] = await Promise.all([p1, p2]);
		strictEqual(r1.jwt.iss, iss);
		strictEqual(r2.jwt.iss, iss);
		// A single fetch served both concurrent callers (in-flight dedup).
		strictEqual(fetchCount, 1);
	} finally {
		globalThis.fetch = original;
	}
});

// --- imported-key caches reused across invocations ---

test("issuers: imported JWK key is reused across invocations (only one fetch, repeated verify)", async (t) => {
	// Reuses the cached JWKS and the imported key across two verifications. We
	// can only observe the JWKS-fetch dedup directly; the second verify still
	// succeeds, exercising the jwkKeyCache hit path.
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		const r1 = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		const r2 = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(r1.jwt.iss, iss);
		strictEqual(r2.jwt.iss, iss);
		strictEqual(fetchStub.calls.filter((c) => c.url === jwksUri).length, 1);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: a fresh cached doc is reused without refetch even when cooldown is 0", async (t) => {
	// cooldownDuration:0 removes the network-cooldown shield, while cacheExpiry
	// stays large so the cached doc is fresh. The getJwk staleness guard MUST
	// short-circuit (skip fetchJwks) and the first-lookup find MUST locate the
	// key, so the second request issues no extra fetch. A mutated staleness
	// guard (always refetch / inverted comparison) or a broken find/rotation
	// path would re-fetch over the network here, yielding 2+ fetches.
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await signToken({ privateKey, alg: "RS256", kid, iss });
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				cooldownDuration: 0,
				cacheExpiry: 600_000,
				disablePrefetch: true,
			}),
		);
		const r1 = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		// Advance the clock so a stale-comparison mutant (>= or inverted) would
		// definitely see elapsed time and refetch.
		await new Promise((r) => setTimeout(r, 5));
		const r2 = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(r1.jwt.iss, iss);
		strictEqual(r2.jwt.iss, iss);
		strictEqual(fetchStub.calls.filter((c) => c.url === jwksUri).length, 1);
	} finally {
		fetchStub.restore();
	}
});

test("issuers: a token without exp verifies when requireExp is not set", async (t) => {
	// No requireExp option: a token lacking exp must verify. A mutant forcing
	// requiredClaims:['exp'] unconditionally would reject it (401).
	const { privateKey, jwk, kid } = await jwksFixture();
	const iss = "https://idp.example.com/pool";
	const jwksUri = nextJwksUri();
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: "RS256", kid })
		.setIssuedAt()
		.setIssuer(iss)
		.sign(privateKey);
	const fetchStub = installFetch({
		[jwksUri]: jwksResponse({ keys: [jwk] }),
	});
	try {
		const handler = middy((event, context) => context).use(
			httpJwt({
				issuers: { [iss]: { jwksUri } },
				algorithm: "RS256",
				disablePrefetch: true,
			}),
		);
		const result = await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			{ ...defaultContext },
		);
		strictEqual(result.jwt.iss, iss);
	} finally {
		fetchStub.restore();
	}
});
