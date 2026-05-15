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
