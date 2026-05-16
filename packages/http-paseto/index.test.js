import { ok, strictEqual } from "node:assert/strict";
import { createPublicKey } from "node:crypto";
import { test } from "node:test";
import { V4 } from "paseto";
import middy from "../core/index.js";
import realHttpPaseto, { httpPasetoValidateOptions } from "./index.js";

// Tests below assume the verified payload is exposed on request.context for
// assertion convenience. The middleware default is internal-only (matches
// `ssm`/`secrets-manager`), so we wrap with `setToContext: true` here. Tests
// that exercise the default behavior call `realHttpPaseto` directly.
const httpPaseto = (opts = {}) =>
	realHttpPaseto({ setToContext: true, ...opts });

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

test("It should read PASETO from a cookie when tokenCookieName is set", async (t) => {
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
		.use(
			httpPaseto({ internalKey: "pubKey", tokenCookieName: "paseto_token" }),
		);

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
		.use(
			httpPaseto({ internalKey: "pubKey", tokenCookieName: "paseto_token" }),
		);

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
		.use(
			httpPaseto({ internalKey: "pubKey", tokenCookieName: "paseto_token" }),
		);

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
		.use(
			httpPaseto({ internalKey: "pubKey", tokenCookieName: "paseto_token" }),
		);

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

test("It should read PASETO from a custom header when tokenHeaderName is set", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "user-hdr" }, privateKey, {
		expiresIn: "1h",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey", tokenHeaderName: "X-Id-Token" }));

	const result = await handler(
		{ headers: { "X-Id-Token": token } },
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "user-hdr");
});

test("It should read PASETO from a lowercased custom header when literal case is absent", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "user-hdr-lower" }, privateKey, {
		expiresIn: "1h",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey", tokenHeaderName: "X-Id-Token" }));

	const result = await handler(
		{ headers: { "x-id-token": token } },
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "user-hdr-lower");
});

test("It should throw 401 when custom header is missing for PASETO", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy(() => {})
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey", tokenHeaderName: "X-Id-Token" }));

	try {
		await handler({ headers: {} }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should read PASETO from a query parameter when tokenQueryStringName is set", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "user-qs" }, privateKey, {
		expiresIn: "1h",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey", tokenQueryStringName: "paseto" }));

	const result = await handler(
		{ headers: {}, queryStringParameters: { paseto: token } },
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "user-qs");
});

test("It should throw 401 when tokenQueryStringName is missing for PASETO", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy(() => {})
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey", tokenQueryStringName: "paseto" }));

	try {
		await handler({ headers: {} }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should throw 401 when event has no headers at all for PASETO", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy(() => {})
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey" }));

	try {
		await handler({}, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should fall through when Authorization header has wrong number of parts for PASETO", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "from-query-malformed" }, privateKey, {
		expiresIn: "1h",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(
			httpPaseto({
				internalKey: "pubKey",
				tokenHeaderName: "Authorization",
				tokenQueryStringName: "paseto",
			}),
		);

	const result = await handler(
		{
			headers: { authorization: "MalformedHeaderNoSpaces" },
			queryStringParameters: { paseto: token },
		},
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "from-query-malformed");
});

test("It should chain cookie -> header -> query, cookie wins when present for PASETO", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const cookieToken = await V4.sign({ sub: "from-cookie" }, privateKey, {
		expiresIn: "1h",
	});
	const headerToken = await V4.sign({ sub: "from-header" }, privateKey, {
		expiresIn: "1h",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(
			httpPaseto({
				internalKey: "pubKey",
				tokenCookieName: "paseto_token",
				tokenHeaderName: "Authorization",
				tokenQueryStringName: "paseto",
			}),
		);

	const result = await handler(
		{
			headers: {
				cookie: `paseto_token=${cookieToken}`,
				authorization: `Bearer ${headerToken}`,
			},
			queryStringParameters: { paseto: "ignored" },
		},
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "from-cookie");
});

test("It should fall through to query when cookie and header are absent for PASETO", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);

	const token = await V4.sign({ sub: "from-query" }, privateKey, {
		expiresIn: "1h",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(
			httpPaseto({
				internalKey: "pubKey",
				tokenCookieName: "paseto_token",
				tokenHeaderName: "Authorization",
				tokenQueryStringName: "paseto",
			}),
		);

	const result = await handler(
		{ headers: {}, queryStringParameters: { paseto: token } },
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "from-query");
});

test("setToContext: false (default) writes only to internal, not context for PASETO", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign({ sub: "user-internal-only" }, privateKey, {
		expiresIn: "1h",
	});
	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const seen = {};
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(realHttpPaseto({ internalKey: "pubKey" }))
		.before((request) => {
			seen.internal = request.internal.paseto?.sub;
			seen.context = request.context.paseto?.sub;
		});

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(seen.internal, "user-internal-only");
	strictEqual(seen.context, undefined);
	strictEqual(result.paseto, undefined);
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

test("It should accept Authorization header delivered as an array (multiValueHeaders / repeated headers)", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign({ sub: "array-hdr" }, privateKey, {
		expiresIn: "1h",
	});

	const handler = makeHandlerWithKey(publicKey);

	const result = await handler(
		{ headers: { authorization: [`Bearer ${token}`, "Bearer other"] } },
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "array-hdr");
});

test("It should strip RFC 6265 surrounding double-quotes from a cookie value", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign({ sub: "quoted-cookie" }, privateKey, {
		expiresIn: "1h",
	});

	const handler = makeHandlerWithKey(publicKey, {
		tokenCookieName: "paseto_token",
	});

	const result = await handler(
		{ headers: { cookie: `paseto_token="${token}"; other=val` } },
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "quoted-cookie");
});
