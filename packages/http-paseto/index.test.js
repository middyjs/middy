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

	// Token already expired 5s ago, but well within the 30s clockTolerance.
	const token = await V4.sign({ sub: "user-1" }, privateKey, {
		expiresIn: "1s",
		now: new Date(Date.now() - 5000),
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
		strictEqual(e.message, "Unauthorized");
		strictEqual(e.cause.package, "@middy/http-paseto");
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
		strictEqual(e.message, "No key source configured: set internalKey");
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should NOT return the credential of a non-Bearer 2-part Authorization header", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	// A valid token carried under the wrong scheme must be ignored (the scheme
	// check rejects it). With only the Authorization source, that means 401.
	const token = await V4.sign({ sub: "wrong-scheme" }, privateKey, {
		expiresIn: "1h",
	});

	const handler = makeHandlerWithKey(publicKey);

	try {
		await handler(makeEvent(`Basic ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should NOT return a part of a 3-part Bearer Authorization header", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	// `Bearer <token> extra` has 3 parts: the length check must reject it even
	// though the scheme is Bearer.
	const token = await V4.sign({ sub: "three-parts" }, privateKey, {
		expiresIn: "1h",
	});

	const handler = makeHandlerWithKey(publicKey);

	try {
		await handler(makeEvent(`Bearer ${token} extra`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should 401 (not crash) when the header source gets a nullish event", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const handler = makeHandlerWithKey(publicKey);

	// Default config uses the Authorization header source; a null event must be
	// guarded by `event?.headers`, ending in a clean 401 rather than a crash.
	try {
		await handler(null, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should 401 (not crash) when the query source gets a nullish event", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	const handler = middy(() => {})
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "pubKey", tokenQueryStringName: "paseto" }));

	// Query-only source with a null event: `event?.queryStringParameters` must
	// be guarded, ending in a clean 401 rather than a TypeError crash.
	try {
		await handler(null, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should NOT fall back to the Authorization header when an explicit source is configured", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign({ sub: "should-not-be-read" }, privateKey, {
		expiresIn: "1h",
	});
	const spkiDer = publicKey.export({ type: "spki", format: "der" });

	// Only a cookie source is configured. A valid Bearer token in the
	// Authorization header must be ignored (no implicit Authorization fallback),
	// so with no cookie present the result is 401.
	const handler = middy(() => {})
		.before((request) => {
			request.internal.pubKey = new Uint8Array(spkiDer);
		})
		.use(
			httpPaseto({ internalKey: "pubKey", tokenCookieName: "paseto_token" }),
		);

	try {
		await handler(
			{ headers: { authorization: `Bearer ${token}` } },
			defaultContext,
		);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
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
	httpPasetoValidateOptions({ internalKey: "k", maxTokenAge: "1h" });
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

test("It should resolve a hyphenated internalKey without a spurious 500", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign({ sub: "user-hyphen-key" }, privateKey, {
		expiresIn: "1h",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal["paseto-key"] = new Uint8Array(spkiDer);
		})
		.use(httpPaseto({ internalKey: "paseto-key" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.paseto.sub, "user-hyphen-key");
});

test("It should resolve a dotted nested internalKey without a spurious 500", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign({ sub: "user-dotted-key" }, privateKey, {
		expiresIn: "1h",
	});

	const spkiDer = publicKey.export({ type: "spki", format: "der" });
	const handler = middy((event, context) => context)
		.before((request) => {
			request.internal.kms = { publicKey: new Uint8Array(spkiDer) };
		})
		.use(httpPaseto({ internalKey: "kms.publicKey" }));

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.paseto.sub, "user-dotted-key");
});

test("It should accept a token without exp by default", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	// No expiresIn: token has no exp claim.
	const token = await V4.sign({ sub: "user-no-exp" }, privateKey);

	const handler = makeHandlerWithKey(publicKey);

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.paseto.sub, "user-no-exp");
});

test("It should reject a token older than maxTokenAge", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	// iat stamped 2 hours ago via the `now` option, no exp claim.
	const token = await V4.sign({ sub: "user-stale" }, privateKey, {
		now: new Date(Date.now() - 7200 * 1000),
	});

	const handler = makeHandlerWithKey(publicKey, { maxTokenAge: "1h" });

	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should accept a fresh token within maxTokenAge", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign({ sub: "user-fresh" }, privateKey);

	const handler = makeHandlerWithKey(publicKey, { maxTokenAge: "1h" });

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.paseto.sub, "user-fresh");
});

// --- Option-schema type validation (httpPasetoValidateOptions) ---

const expectOptionTypeError = (opts, expectedMessage) => {
	try {
		httpPasetoValidateOptions(opts);
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-paseto");
		strictEqual(e.message, expectedMessage);
	}
};

test("httpPasetoValidateOptions accepts and enforces string type for tokenCookieName", () => {
	httpPasetoValidateOptions({ tokenCookieName: "tok" });
	expectOptionTypeError(
		{ tokenCookieName: 123 },
		"Option 'tokenCookieName' must be string",
	);
});

test("httpPasetoValidateOptions accepts and enforces string type for tokenHeaderName", () => {
	httpPasetoValidateOptions({ tokenHeaderName: "X-Tok" });
	expectOptionTypeError(
		{ tokenHeaderName: 123 },
		"Option 'tokenHeaderName' must be string",
	);
});

test("httpPasetoValidateOptions accepts and enforces string type for tokenQueryStringName", () => {
	httpPasetoValidateOptions({ tokenQueryStringName: "tok" });
	expectOptionTypeError(
		{ tokenQueryStringName: 123 },
		"Option 'tokenQueryStringName' must be string",
	);
});

test("httpPasetoValidateOptions accepts and enforces string type for issuer", () => {
	httpPasetoValidateOptions({ issuer: "https://iss" });
	expectOptionTypeError({ issuer: 123 }, "Option 'issuer' must be string");
});

test("httpPasetoValidateOptions accepts and enforces string type for clockTolerance", () => {
	httpPasetoValidateOptions({ clockTolerance: "30s" });
	expectOptionTypeError(
		{ clockTolerance: 123 },
		"Option 'clockTolerance' must be string",
	);
});

test("httpPasetoValidateOptions accepts and enforces string type for payloadKey", () => {
	httpPasetoValidateOptions({ payloadKey: "paseto" });
	expectOptionTypeError(
		{ payloadKey: 123 },
		"Option 'payloadKey' must be string",
	);
});

test("httpPasetoValidateOptions accepts and enforces boolean type for setToContext", () => {
	httpPasetoValidateOptions({ setToContext: true });
	expectOptionTypeError(
		{ setToContext: "yes" },
		"Option 'setToContext' must be boolean",
	);
});

// --- Verify-options forwarding to V4.verify (claim mismatches must 401) ---

test("It should reject a token whose audience does not match the configured audience", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign(
		{ sub: "user-1", aud: "https://wrong.example.com" },
		privateKey,
		{ expiresIn: "1h" },
	);

	const handler = makeHandlerWithKey(publicKey, {
		audience: "https://api.example.com",
	});

	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should accept a token (no audience option) regardless of its aud claim", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign(
		{ sub: "user-no-aud-opt", aud: "https://whatever.example.com" },
		privateKey,
		{ expiresIn: "1h" },
	);

	const handler = makeHandlerWithKey(publicKey);

	const result = await handler(makeEvent(`Bearer ${token}`), {
		...defaultContext,
	});

	strictEqual(result.paseto.sub, "user-no-aud-opt");
});

test("It should reject a token whose issuer does not match the configured issuer", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign(
		{ sub: "user-1", iss: "https://wrong-auth.example.com" },
		privateKey,
		{ expiresIn: "1h" },
	);

	const handler = makeHandlerWithKey(publicKey, {
		issuer: "https://auth.example.com",
	});

	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should reject an expired token when no clockTolerance is configured", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	// Expired 10s ago.
	const token = await V4.sign({ sub: "user-expired" }, privateKey, {
		expiresIn: "1s",
		now: new Date(Date.now() - 10000),
	});

	const handler = makeHandlerWithKey(publicKey);

	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

// --- Error messages and causes ---

test("It should throw 401 'Unauthorized' with the no-token cause when no token is found", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const handler = makeHandlerWithKey(publicKey);

	try {
		await handler({ headers: {} }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.message, "Unauthorized");
		strictEqual(e.cause.data, "No token found in configured sources");
	}
});

test("It should throw 401 'Unauthorized' with the unsupported-version cause for a non-v4.public token", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const handler = makeHandlerWithKey(publicKey);

	try {
		await handler(makeEvent("Bearer v3.public.sometoken"), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.message, "Unauthorized");
		strictEqual(e.cause.package, "@middy/http-paseto");
		strictEqual(e.cause.data, "Unsupported PASETO version or purpose");
	}
});

test("It should require the exact v4.public. prefix (a v4.local token is rejected as unsupported)", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const handler = makeHandlerWithKey(publicKey);

	try {
		await handler(makeEvent("Bearer v4.local.sometoken"), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.data, "Unsupported PASETO version or purpose");
	}
});

test("It should throw 500 'Internal Server Error' with the resolved-undefined cause", async (t) => {
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
		strictEqual(e.message, "Internal Server Error");
		strictEqual(e.cause.data, "internalKey 'missing' resolved to undefined");
	}
});

test("It should 401 (not crash) when the cookie source gets a nullish event", async (t) => {
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

	// event is null: readCookieValue's `event?.headers` guard must hold, so the
	// source returns undefined and the chain ends in a clean 401. Dropping the
	// optional chain would throw a raw TypeError without statusCode/cause.
	try {
		await handler(null, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should 401 (not crash) when the cookie source gets null headers", async (t) => {
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

	// headers is null: both `headers?.cookie` and `headers?.Cookie` guards must
	// hold so the cookie lookup yields undefined and ends in a clean 401.
	try {
		await handler({ headers: null }, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
		strictEqual(e.cause.package, "@middy/http-paseto");
	}
});

test("It should surface an invalid-key-arg error (not a null-deref) when internalKey resolves to null", async (t) => {
	const privateKey = await V4.generateKey("public");
	const token = await V4.sign({ sub: "x" }, privateKey, { expiresIn: "1h" });

	const handler = middy(() => {})
		.before((request) => {
			// null slips past the `=== undefined` guard, so it reaches key import.
			request.internal.k = null;
		})
		.use(httpPaseto({ internalKey: "k" }));

	// Real code: `keyData?.publicKey` is undefined, bytes = null, and
	// createPublicKey rejects null with ERR_INVALID_ARG_TYPE. Dropping the
	// optional chain would instead throw "Cannot read properties of null"
	// (no `code`).
	try {
		await handler(makeEvent(`Bearer ${token}`), defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.code, "ERR_INVALID_ARG_TYPE");
	}
});

test("It should NOT strip an unquoted cookie value (plain token verifies as-is)", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign({ sub: "plain-cookie" }, privateKey, {
		expiresIn: "1h",
	});

	const handler = makeHandlerWithKey(publicKey, {
		tokenCookieName: "paseto_token",
	});

	// No surrounding quotes: real code must NOT strip. Any quote-check mutant
	// that forces a strip here would slice off the first/last token bytes and
	// fail verification.
	const result = await handler(
		{ headers: { cookie: `paseto_token=${token}` } },
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "plain-cookie");
});

test("It should NOT strip a cookie value with only a trailing quote (kept verbatim)", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign({ sub: "trail-quote" }, privateKey, {
		expiresIn: "1h",
	});

	const handler = makeHandlerWithKey(publicKey, {
		tokenCookieName: "paseto_token",
	});

	// Trailing quote only (no leading quote): real code must NOT strip, and
	// PASETO tolerates the stray trailing quote, so verification succeeds.
	// A mutant that strips on the trailing quote alone would slice off the
	// leading token byte and fail verification.
	const result = await handler(
		{ headers: { cookie: `paseto_token=${token}"` } },
		{ ...defaultContext },
	);

	strictEqual(result.paseto.sub, "trail-quote");
});

test("It should NOT strip a cookie value that has a leading quote but no trailing quote", async (t) => {
	const privateKey = await V4.generateKey("public");
	const publicKey = createPublicKey(privateKey);
	const token = await V4.sign({ sub: "lead-quote" }, privateKey, {
		expiresIn: "1h",
	});

	const handler = makeHandlerWithKey(publicKey, {
		tokenCookieName: "paseto_token",
	});

	// Leading quote, plus a trailing non-quote byte. Real code requires BOTH
	// quotes to strip, so it keeps the value verbatim: the leading quote breaks
	// verification -> 401. A mutant that strips when only the leading quote is
	// present (e.g. endsWith swapped to startsWith) would slice(1,-1) to the
	// exact valid token and wrongly succeed.
	try {
		await handler(
			{ headers: { cookie: `paseto_token="${token}Z` } },
			defaultContext,
		);
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.statusCode, 401);
	}
});
