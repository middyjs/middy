import { ok, strictEqual } from "node:assert/strict";
import { generateKeyPair } from "node:crypto";
import { test } from "node:test";
import { promisify } from "node:util";
import { importPKCS8, SignJWT } from "jose";
import middy from "../core/index.js";
import httpJwt, { httpJwtValidateOptions } from "./index.js";

const generateKeyPairAsync = promisify(generateKeyPair);

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

test("It should throw TypeError at factory when secretKey is used without algorithm", () => {
	try {
		httpJwt({ secretKey: "s" });
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

test("It should read JWT from a cookie when cookieName is set", async (t) => {
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
			cookieName: "access_token",
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
			cookieName: "access_token",
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
		httpJwt({ secretKey: "s", algorithm: "HS256", cookieName: "access_token" }),
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
		httpJwt({ secretKey: "s", algorithm: "HS256", cookieName: "access_token" }),
	);

	try {
		await handler({ headers: {} }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});

test("It should auto-detect algorithm from KMS keySpec when internalKey resolves to { publicKey, keySpec }", async (t) => {
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
		.use(httpJwt({ internalKey: "kmsKey" }));

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
		.use(httpJwt({ internalKey: "missing" }));

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
		.use(httpJwt({ internalKey: "kmsKey" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-unknown-spec");
});

test("It should verify RS256 JWT via internalKey (plain Uint8Array) without explicit algorithm", async (t) => {
	const { privateKey, publicKey } = await generateKeyPairAsync("rsa", {
		modulusLength: 2048,
	});

	const importedPrivate = await importPKCS8(
		privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
		"RS256",
	);

	const token = await new SignJWT({ sub: "user-no-alg" })
		.setProtectedHeader({ alg: "RS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(importedPrivate);

	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpJwt({ internalKey: "pubKey" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-no-alg");
});

test("It should verify HS256 JWT via internalKey (plain string) without explicit algorithm", async (t) => {
	const secret = "super-secret-key-for-testing-1234";

	const token = await new SignJWT({ sub: "user-no-alg-str" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(Buffer.from(secret));

	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.hmacKey = secret;
		})
		.use(httpJwt({ internalKey: "hmacKey" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.jwt.sub, "user-no-alg-str");
});

test("httpJwtValidateOptions accepts valid options and rejects typos", () => {
	httpJwtValidateOptions({ secretKey: "s", algorithm: "HS256" });
	httpJwtValidateOptions({});
	try {
		httpJwtValidateOptions({ sekretKey: "s" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-jwt");
	}
});
