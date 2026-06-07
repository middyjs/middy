import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { clearCache, processCache } from "@middy/util";
import middy from "../core/index.js";
import dsqlMiddleware, { dsqlValidateOptions } from "./index.js";

test.afterEach(() => {
	clearCache();
});

const defaultEvent = {};
const newContext = () => ({
	getRemainingTimeInMillis: () => 1000,
});

const validHost = "cluster.dsql.us-east-1.on.aws";

const buildClient = (t, { client, end } = {}) => {
	const endFn = end ?? t.mock.fn(async () => {});
	const clientFn = client ?? t.mock.fn(() => ({ end: endFn, mark: "client" }));
	return { client: clientFn, end: endFn };
};

test("It should instantiate the client and attach it to context", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost, username: "admin" },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);

	let captured;
	handler.before(async (request) => {
		captured = request.context.dsql;
	});

	await handler(defaultEvent, newContext());
	strictEqual(client.mock.callCount(), 1);
	strictEqual(captured?.mark, "client");
});

test("It should pass config to the client with ssl:true default", async (t) => {
	const { client } = buildClient(t);
	const config = {
		host: validHost,
		username: "admin",
		database: "postgres",
	};
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config,
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	await handler(defaultEvent, newContext());
	deepStrictEqual(client.mock.calls[0].arguments[0], { ssl: true, ...config });
});

test("It should allow ssl to be overridden in config", async (t) => {
	const { client } = buildClient(t);
	const config = { host: validHost, ssl: false };
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config,
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	await handler(defaultEvent, newContext());
	deepStrictEqual(client.mock.calls[0].arguments[0], {
		ssl: false,
		host: validHost,
	});
});

test("It should merge token from internalKey into config.password", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {})
		.before(async (request) => {
			request.internal.dsqlToken = "iam-token-abc";
		})
		.use(
			dsqlMiddleware({
				client,
				config: { host: validHost, username: "admin" },
				internalKey: "dsqlToken",
				cacheExpiry: 0,
				disablePrefetch: true,
			}),
		);
	await handler(defaultEvent, newContext());
	const arg = client.mock.calls[0].arguments[0];
	strictEqual(arg.password, "iam-token-abc");
	strictEqual(arg.host, validHost);
	strictEqual(arg.ssl, true);
});

test("It should default cacheExpiry to 0 when internalKey is set and cacheExpiry is omitted", async (t) => {
	const { client, end } = buildClient(t);
	const handler = middy(() => {})
		.before(async (request) => {
			request.internal.dsqlToken = "iam-token-abc";
		})
		.use(
			dsqlMiddleware({
				client,
				config: { host: validHost, username: "admin" },
				internalKey: "dsqlToken",
				disablePrefetch: true,
			}),
		);
	await handler(defaultEvent, newContext());
	strictEqual(end.mock.callCount(), 1);
});

test("It should NOT override an explicit cacheExpiry when internalKey is set", async (t) => {
	const { client, end } = buildClient(t);
	const handler = middy(() => {})
		.before(async (request) => {
			request.internal.dsqlToken = "iam-token-abc";
		})
		.use(
			dsqlMiddleware({
				client,
				config: { host: validHost, username: "admin" },
				internalKey: "dsqlToken",
				cacheExpiry: -1,
				cacheKey: "test-internalkey-explicit-expiry",
			}),
		);
	await handler(defaultEvent, newContext());
	await handler(defaultEvent, newContext());
	// cacheExpiry stays -1 (not coerced to 0), so end() is never called and the
	// client is reused across invocations.
	strictEqual(end.mock.callCount(), 0);
	strictEqual(client.mock.callCount(), 1);
});

test("It should throw when internalKey is set but token is missing", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			internalKey: "dsqlToken",
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	let captured;
	try {
		await handler(defaultEvent, newContext());
	} catch (e) {
		captured = e;
	}
	ok(captured);
	strictEqual(captured.cause?.package, "@middy/dsql");
});

test("It should throw the descriptive not-found error (not a TypeError) when request.internal is absent", async (t) => {
	const { client } = buildClient(t);
	const middleware = dsqlMiddleware({
		client,
		config: { host: validHost },
		internalKey: "dsqlToken",
		cacheExpiry: 0,
		disablePrefetch: true,
	});
	// Craft a request whose `internal` is missing entirely. The optional chaining
	// must yield `undefined` (not throw a TypeError on property access), so the
	// middleware raises the descriptive guard error instead.
	const request = { context: {}, internal: undefined };
	let captured;
	try {
		await middleware.before(request);
	} catch (e) {
		captured = e;
	}
	ok(captured);
	strictEqual(
		captured.message,
		"internalKey 'dsqlToken' not found; ensure @middy/dsql-signer runs before @middy/dsql",
	);
	strictEqual(captured.cause?.package, "@middy/dsql");
	strictEqual(client.mock.callCount(), 0);
});

test("It should throw the descriptive not-found error when the request itself is absent", async (t) => {
	const { client } = buildClient(t);
	const middleware = dsqlMiddleware({
		client,
		config: { host: validHost },
		internalKey: "dsqlToken",
		cacheExpiry: 0,
		disablePrefetch: true,
	});
	// With no request at all, `request?.internal?.[key]` must short-circuit to
	// undefined and raise the guard error, rather than a TypeError from reading
	// `.internal` on undefined.
	let captured;
	try {
		await middleware.before(undefined);
	} catch (e) {
		captured = e;
	}
	ok(captured);
	strictEqual(
		captured.message,
		"internalKey 'dsqlToken' not found; ensure @middy/dsql-signer runs before @middy/dsql",
	);
	strictEqual(captured.cause?.package, "@middy/dsql");
	strictEqual(client.mock.callCount(), 0);
});

test("It should honour custom contextKey", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			contextKey: "db",
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);

	let captured;
	handler.before(async (request) => {
		captured = { dsql: request.context.dsql, db: request.context.db };
	});

	await handler(defaultEvent, newContext());
	strictEqual(captured.dsql, undefined);
	strictEqual(captured.db?.mark, "client");
});

test("It should call end() on after when cacheExpiry is 0", async (t) => {
	const { client, end } = buildClient(t);
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	await handler(defaultEvent, newContext());
	strictEqual(end.mock.callCount(), 1);
});

test("It should not call end() when cacheExpiry is not 0", async (t) => {
	const { client, end } = buildClient(t);
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: -1,
			cacheKey: "test-no-end",
		}),
	);
	await handler(defaultEvent, newContext());
	await handler(defaultEvent, newContext());
	strictEqual(end.mock.callCount(), 0);
	strictEqual(client.mock.callCount(), 1);
});

test("It should swallow cleanup errors in after", async (t) => {
	const end = t.mock.fn(async () => {
		throw new Error("end failed");
	});
	const { client } = buildClient(t, { end });
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	await handler(defaultEvent, newContext());
	strictEqual(end.mock.callCount(), 1);
});

test("It should log a descriptive message to console.error when cleanup fails", async (t) => {
	const errorMock = t.mock.method(console, "error", () => {});
	const end = t.mock.fn(async () => {
		throw new Error("end failed");
	});
	const { client } = buildClient(t, { end });
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	await handler(defaultEvent, newContext());
	// catch block must run and log with the exact format string + args.
	strictEqual(errorMock.mock.callCount(), 1);
	deepStrictEqual(errorMock.mock.calls[0].arguments, [
		"%s: cleanup error: %s",
		"@middy/dsql",
		"end failed",
	]);
});

test("It should run cleanup on onError too", async (t) => {
	const { client, end } = buildClient(t);
	const handler = middy(() => {
		throw new Error("boom");
	}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	try {
		await handler(defaultEvent, newContext());
	} catch (_e) {}
	ok(end.mock.callCount() >= 1);
});

test("It should reuse cached client across invocations when cacheExpiry is -1", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "test-reuse",
		}),
	);
	await handler(defaultEvent, newContext());
	await handler(defaultEvent, newContext());
	await handler(defaultEvent, newContext());
	strictEqual(client.mock.callCount(), 1);
});

test("It should re-instantiate per invocation when cacheExpiry is 0", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	await handler(defaultEvent, newContext());
	await handler(defaultEvent, newContext());
	strictEqual(client.mock.callCount(), 2);
});

test("It should re-create per invocation and not double-end with cacheExpiry 0 and prefetch enabled", async (t) => {
	const { client, end } = buildClient(t);
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: 0,
		}),
	);
	await handler(defaultEvent, newContext());
	await handler(defaultEvent, newContext());
	strictEqual(client.mock.callCount(), 2);
	strictEqual(end.mock.callCount(), 2);
});

test("It should surface a refreshed cache entry in before, not a stale prefetch", async (t) => {
	let n = 0;
	const client = t.mock.fn(() => ({
		end: async () => {},
		mark: `client-${++n}`,
	}));
	const opts = {
		client,
		config: { host: validHost, username: "admin" },
		cacheKey: "dsql-refresh",
		cacheExpiry: -1,
	};
	const handler = middy(() => {}).use(dsqlMiddleware(opts));
	let captured;
	handler.before(async (request) => {
		captured = request.context.dsql;
	});
	await handler(defaultEvent, newContext());
	strictEqual(captured.mark, "client-1");
	// Rebuild the shared cache with a fresh client, as the auto-refresh timer would
	clearCache();
	processCache({ ...opts }, () => client());
	await handler(defaultEvent, newContext());
	strictEqual(captured.mark, "client-2");
});

test("It should prefetch the client at construction time when prefetch is enabled", async (t) => {
	const { client } = buildClient(t);
	// No disablePrefetch, default cacheExpiry (-1): prefetch should fire eagerly.
	dsqlMiddleware({
		client,
		config: { host: validHost },
		cacheKey: "test-construct-prefetch",
	});
	// Client invoked at construction, before any handler invocation.
	strictEqual(client.mock.callCount(), 1);
});

test("It should NOT prefetch at construction when disablePrefetch is the default true under mutation", async (t) => {
	const { client } = buildClient(t);
	// internalKey set => construction prefetch must be skipped entirely.
	dsqlMiddleware({
		client,
		config: { host: validHost },
		internalKey: "dsqlToken",
		cacheKey: "test-no-construct-prefetch",
	});
	strictEqual(client.mock.callCount(), 0);
});

test("It should not prefetch at construction when disablePrefetch is explicitly true", async (t) => {
	const { client } = buildClient(t);
	dsqlMiddleware({
		client,
		config: { host: validHost },
		disablePrefetch: true,
		cacheKey: "test-disabled-prefetch",
	});
	strictEqual(client.mock.callCount(), 0);
});

test("It should cache the client indefinitely by default (no refresh timer)", async (t) => {
	const { client } = buildClient(t);
	dsqlMiddleware({
		client,
		config: { host: validHost },
		cacheKey: "test-default-infinite",
	});
	// Construction prefetch -> 1 call. With the default cacheExpiry of -1 there is
	// no refresh timer; a positive finite default would schedule a timer that
	// re-fetches after the duration elapses.
	strictEqual(client.mock.callCount(), 1);
	await new Promise((resolve) => setTimeout(resolve, 25));
	strictEqual(client.mock.callCount(), 1);
});

test("It should throw if client option is missing", () => {
	try {
		dsqlMiddleware({ config: { host: validHost } });
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.message, "client option missing");
		strictEqual(e.cause?.package, "@middy/dsql");
	}
});

test("It should throw if client is not a function", () => {
	try {
		dsqlMiddleware({ client: {}, config: { host: validHost } });
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.message, "client must be a function");
	}
});

test("dsqlValidateOptions accepts a minimal valid config", () => {
	dsqlValidateOptions({
		client: () => ({}),
		config: { host: validHost },
	});
});

test("dsqlValidateOptions accepts the full surface", () => {
	dsqlValidateOptions({
		client: () => ({}),
		config: {
			host: validHost,
			username: "admin",
			database: "postgres",
			port: 5432,
		},
		contextKey: "dsql",
		internalKey: "dsqlToken",
		disablePrefetch: false,
		cacheKey: "k",
		cacheKeyExpiry: { k: 60_000 },
		cacheExpiry: -1,
	});
});

test("dsqlValidateOptions accepts additional config properties (passed through to pg)", () => {
	// config.additionalProperties is true: arbitrary pg client options are allowed.
	dsqlValidateOptions({
		client: () => ({}),
		config: {
			host: validHost,
			connectionTimeoutMillis: 5000,
			application_name: "svc",
		},
	});
});

test("dsqlValidateOptions accepts a cacheKeyExpiry value of -1 (infinite)", () => {
	// cacheKeyExpiry per-key values share the cacheExpiry semantics: -1 is valid.
	dsqlValidateOptions({
		client: () => ({}),
		config: { host: validHost },
		cacheKeyExpiry: { "@middy/dsql": -1 },
	});
});

test("dsqlValidateOptions rejects a cacheKeyExpiry value below -1", () => {
	try {
		dsqlValidateOptions({
			client: () => ({}),
			config: { host: validHost },
			cacheKeyExpiry: { "@middy/dsql": -2 },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("dsqlValidateOptions rejects unknown options (typo guard)", () => {
	try {
		dsqlValidateOptions({
			client: () => ({}),
			config: { host: validHost },
			cachExpiry: 60,
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/dsql");
	}
});

test("dsqlValidateOptions rejects non-DSQL hostname", () => {
	try {
		dsqlValidateOptions({
			client: () => ({}),
			config: { host: "db.example.com" },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/dsql");
	}
});

test("dsqlValidateOptions rejects missing host", () => {
	try {
		dsqlValidateOptions({
			client: () => ({}),
			config: { username: "admin" },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("dsqlValidateOptions rejects missing client", () => {
	try {
		dsqlValidateOptions({ config: { host: validHost } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("dsqlValidateOptions rejects non-function client", () => {
	try {
		dsqlValidateOptions({
			client: "nope",
			config: { host: validHost },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("dsqlValidateOptions rejects out-of-range port", () => {
	try {
		dsqlValidateOptions({
			client: () => ({}),
			config: { host: validHost, port: 99999 },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});
