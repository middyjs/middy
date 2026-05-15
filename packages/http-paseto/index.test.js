import { ok, strictEqual } from "node:assert/strict";
import { createPublicKey } from "node:crypto";
import { test } from "node:test";
import { V4 } from "paseto";
import middy from "../core/index.js";
import httpPaseto, { httpPasetoValidateOptions } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const makeEvent = (authorization) => ({
	headers: { authorization },
});

const makeHandlerWithKey = (publicKey, opts = {}) => {
	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	return middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey", ...opts }));
};

test("It should verify a valid v4.public PASETO token and set payload to internal and context", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "user-1", role: "admin" }, privateKey, {
		expiresIn: "1h",
	});

	const ctx = { ...defaultContext };
	const handler = makeHandlerWithKey(publicKey);

	const result = await handler(makeEvent(`Bearer ${token}`), ctx);

	strictEqual(result.paseto.sub, "user-1");
	strictEqual(result.paseto.role, "admin");
	strictEqual(ctx.paseto.sub, "user-1");
});

test("It should always set payload to context", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "user-1" }, privateKey, {
		expiresIn: "1h",
	});

	const ctx = { ...defaultContext };
	const handler = makeHandlerWithKey(publicKey);

	await handler(makeEvent(`Bearer ${token}`), ctx);

	strictEqual(ctx.paseto.sub, "user-1");
});

test("It should use a custom payloadKey", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "user-1" }, privateKey, {
		expiresIn: "1h",
	});

	const ctx = { ...defaultContext };
	const handler = makeHandlerWithKey(publicKey, { payloadKey: "auth" });

	const result = await handler(makeEvent(`Bearer ${token}`), ctx);

	strictEqual(result.auth.sub, "user-1");
});

test("It should verify audience claim", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign(
		{ sub: "user-1", aud: "https://api.example.com" },
		privateKey,
		{ expiresIn: "1h" },
	);

	const ctx = { ...defaultContext };
	const handler = makeHandlerWithKey(publicKey, {
		audience: "https://api.example.com",
	});

	const result = await handler(makeEvent(`Bearer ${token}`), ctx);

	strictEqual(result.paseto.sub, "user-1");
});

test("It should verify issuer claim", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign(
		{ sub: "user-1", iss: "https://auth.example.com" },
		privateKey,
		{ expiresIn: "1h" },
	);

	const ctx = { ...defaultContext };
	const handler = makeHandlerWithKey(publicKey, {
		issuer: "https://auth.example.com",
	});

	const result = await handler(makeEvent(`Bearer ${token}`), ctx);

	strictEqual(result.paseto.sub, "user-1");
});

test("It should respect clockTolerance option for expired tokens", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "user-1" }, privateKey, {
		expiresIn: "1s",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(
			httpPaseto({
				internalKey: "pubKey",
				clockTolerance: "30s",
			}),
		);

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});
	strictEqual(result.paseto.sub, "user-1");
});

test("It should throw 401 when Authorization header is missing", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const handler = makeHandlerWithKey(publicKey);

	try {
		await handler({ headers: {} }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should throw 401 when Authorization scheme is not Bearer", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const handler = makeHandlerWithKey(publicKey);

	try {
		await handler(makeEvent("Basic dXNlcjpwYXNz"), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
	}
});

test("It should throw 401 when token is invalid", async (t) => {
	const privateKey = await V4.generateKey("public");
	const wrongPrivateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "x" }, wrongPrivateKey, {
		expiresIn: "1h",
	});

	const ctx = { ...defaultContext };
	const handler = makeHandlerWithKey(publicKey);

	try {
		await handler(makeEvent(`Bearer ${token}`), ctx);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
	}
});

test("It should throw 401 for unsupported PASETO version", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const ctx = { ...defaultContext };
	const handler = makeHandlerWithKey(publicKey);

	try {
		await handler(makeEvent("Bearer v3.public.sometoken"), ctx);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
	}
});

test("It should throw TypeError at factory when internalKey is not configured", () => {
	try {
		httpPaseto({});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should read PASETO from a cookie when cookieName is set", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "user-1" }, privateKey, {
		expiresIn: "1h",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey", cookieName: "paseto_token" }));

	const result = await handler(
		{ headers: { cookie: `other=val; paseto_token=${token}; extra=1` } },
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "user-1");
});

test("It should read PASETO from capitalized Cookie header when lowercase is absent", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "user-1" }, privateKey, {
		expiresIn: "1h",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey", cookieName: "paseto_token" }));

	const result = await handler(
		{ headers: { Cookie: `paseto_token=${token}` } },
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "user-1");
});

test("It should throw 401 when no cookie header is present for PASETO", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy(() => {})
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey", cookieName: "paseto_token" }));

	try {
		await handler({ headers: {} }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should throw 401 when cookie is missing for PASETO", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy(() => {})
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey", cookieName: "paseto_token" }));

	try {
		await handler({ headers: { cookie: "other=val" } }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should handle KMS { publicKey, keySpec } shape from internalKey", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "user-kms" }, privateKey, {
		expiresIn: "1h",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.kmsKey = {
				publicKey: new Uint8Array(spkiDer),
				keySpec: "ECC_NIST_ED25519",
			};
		})
		.use(httpPaseto({ internalKey: "kmsKey" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.paseto.sub, "user-kms");
});

test("It should throw 500 when internalKey resolves to undefined for PASETO", async (t) => {
	const handler = middy(() => {})
		.before((request) => {
			request.internal.missing = undefined;
		})
		.use(httpPaseto({ internalKey: "missing" }));

	try {
		await handler(makeEvent("Bearer v4.public.sometoken"), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 500);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("httpPasetoValidateOptions accepts valid options and rejects typos", () => {
	httpPasetoValidateOptions({ audience: "https://example.com" });
	httpPasetoValidateOptions({});
	try {
		httpPasetoValidateOptions({ audiance: "typo" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});
