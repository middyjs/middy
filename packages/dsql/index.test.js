import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
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
		captured = request.context.middyContext.dsql;
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
		captured = {
			dsql: request.context.middyContext.dsql,
			db: request.context.middyContext.db,
		};
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
		captured = request.context.middyContext.dsql;
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

test("It should not report a cleanup error when middyContext is absent", async (t) => {
	const { client } = buildClient(t);
	const middleware = dsqlMiddleware({
		client,
		config: { host: validHost, username: "admin" },
		cacheExpiry: 0,
		disablePrefetch: true,
	});

	// onError shares the cleanup handler, so it can fire before `before` ever
	// ran and seeded the namespace. The optional chaining must swallow that;
	// without it the TypeError is caught and logged as a cleanup error.
	const logged = [];
	const originalError = console.error;
	console.error = (...args) => logged.push(args);
	try {
		await middleware.after({ context: {} });
		await middleware.onError({ context: {} });
	} finally {
		console.error = originalError;
	}

	strictEqual(logged.length, 0);
});

test("dsqlValidateOptions validates contextKey as a string", () => {
	// Pins the rule itself: an empty `{}` rule would accept the number below,
	// and a blank `type` would reject the valid string above.
	const client = () => {};
	const config = { host: validHost, username: "admin" };
	dsqlValidateOptions({ client, config, contextKey: "custom" });
	try {
		dsqlValidateOptions({ client, config, contextKey: 123 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("contextKey"));
	}
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

const buildClients = (t) => {
	const clients = [];
	const client = t.mock.fn(() => {
		const created = {
			end: t.mock.fn(async () => {}),
			mark: `client-${clients.length + 1}`,
		};
		clients.push(created);
		return created;
	});
	return { client, clients };
};

test("It should resolve a Promise-valued internalKey token before passing it as password", async (t) => {
	// @middy/dsql-signer stores the token in request.internal as an unresolved
	// Promise. Reading request.internal[key] raw hands the driver a Promise as
	// `password`; the middleware must resolve it via getInternal on every build.
	const { client } = buildClient(t);
	const handler = middy(() => {})
		.before(async (request) => {
			request.internal.dsqlToken = Promise.resolve("tok");
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
	await handler(defaultEvent, newContext());
	strictEqual(client.mock.callCount(), 2);
	strictEqual(client.mock.calls[0].arguments[0].password, "tok");
	strictEqual(client.mock.calls[1].arguments[0].password, "tok");
});

test("It should not cache a rejected client so the next invocation reconnects", async (t) => {
	let attempt = 0;
	const client = t.mock.fn(async () => {
		attempt += 1;
		if (attempt === 1) throw new Error("connect refused");
		return { end: async () => {}, mark: "client" };
	});
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "dsql-reconnect",
			disablePrefetch: true,
		}),
	);
	await rejects(() => handler(defaultEvent, newContext()), /connect refused/);
	await handler(defaultEvent, newContext());
	await handler(defaultEvent, newContext());
	strictEqual(client.mock.callCount(), 2);
});

test("It should close a client replaced by a cache refresh, but not the live one", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const { client, clients } = buildClients(t);
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "dsql-refresh-close",
			cacheExpiry: 20,
			disablePrefetch: true,
		}),
	);
	let captured;
	handler.before(async (request) => {
		captured = request.context.middyContext.dsql;
	});
	await handler(defaultEvent, newContext());
	strictEqual(captured.mark, "client-1");
	// The refresh timer replaces the cached client between invocations.
	t.mock.timers.tick(20);
	await flush();
	strictEqual(clients.length, 2);
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 0);
	await handler(defaultEvent, newContext());
	strictEqual(captured.mark, "client-2");
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 0);
});

test("It should defer closing a replaced client until the invocation holding it completes", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const { client, clients } = buildClients(t);
	const handler = middy(async () => {
		// The refresh fires mid-handler: the client this invocation holds must
		// stay open until the invocation finishes, or an in-flight query dies.
		t.mock.timers.tick(20);
		await flush();
		strictEqual(clients.length, 2);
		strictEqual(clients[0].end.mock.callCount(), 0);
	}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "dsql-refresh-deferred",
			cacheExpiry: 20,
			disablePrefetch: true,
		}),
	);
	await handler(defaultEvent, newContext());
	await flush();
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 0);
});

test("It should not release a lease that a failed connection never acquired", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const { client: connect, clients } = buildClients(t);
	let attempt = 0;
	const client = t.mock.fn(async () => {
		attempt += 1;
		if (attempt === 1) throw new Error("connect refused");
		return connect();
	});
	const handler = middy(async () => {
		// A refresh mid-handler retires the client this invocation holds. The
		// earlier failed invocation released nothing, so the lease count must
		// still protect the live client from being closed here.
		t.mock.timers.tick(20);
		await flush();
		strictEqual(clients.length, 2);
		strictEqual(clients[0].end.mock.callCount(), 0);
	}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "dsql-failed-lease",
			cacheExpiry: 20,
			disablePrefetch: true,
		}),
	);
	await rejects(handler(defaultEvent, newContext()), /connect refused/);
	await handler(defaultEvent, newContext());
	await flush();
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 0);
});

test("It should log and swallow an error from closing a replaced client", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const errorMock = t.mock.method(console, "error", () => {});
	let n = 0;
	const client = t.mock.fn(() => ({
		end: async () => {
			throw new Error(`end failed ${++n}`);
		},
	}));
	middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "dsql-refresh-close-error",
			cacheExpiry: 20,
		}),
	);
	// Construction prefetch creates client 1; the refresh replaces it.
	t.mock.timers.tick(20);
	await flush();
	strictEqual(client.mock.callCount(), 2);
	strictEqual(errorMock.mock.callCount(), 1);
	deepStrictEqual(errorMock.mock.calls[0].arguments, [
		"%s: cleanup error: %s",
		"@middy/dsql",
		"end failed 1",
	]);
});

test("It should close the previous client when a failed reconnect is followed by a successful one", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const { client: connect, clients } = buildClients(t);
	let attempt = 0;
	const client = t.mock.fn(async () => {
		attempt += 1;
		if (attempt === 2) throw new Error("connect refused");
		return connect();
	});
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "dsql-refresh-fail",
			cacheExpiry: 20,
			disablePrefetch: true,
		}),
	);
	await handler(defaultEvent, newContext());
	// The refresh fails: the rejection is dropped from the cache and the
	// original client stays open (nothing replaced it yet).
	t.mock.timers.tick(20);
	await flush();
	strictEqual(client.mock.callCount(), 2);
	strictEqual(clients[0].end.mock.callCount(), 0);
	// The next invocation reconnects and retires the original client.
	await handler(defaultEvent, newContext());
	strictEqual(client.mock.callCount(), 3);
	strictEqual(clients.length, 2);
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 0);
});

test("It should reconnect when the cached client is flagged broken", async (t) => {
	const { client, clients } = buildClients(t);
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "dsql-broken",
			disablePrefetch: true,
		}),
	);
	let captured;
	handler.before(async (request) => {
		captured = request.context.middyContext.dsql;
	});
	await handler(defaultEvent, newContext());
	strictEqual(captured.mark, "client-1");
	// The pg adapters flag the client on an unexpected `error` event.
	clients[0].broken = true;
	await handler(defaultEvent, newContext());
	strictEqual(captured.mark, "client-2");
	strictEqual(client.mock.callCount(), 2);
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 0);
	await handler(defaultEvent, newContext());
	strictEqual(captured.mark, "client-2");
	strictEqual(client.mock.callCount(), 2);
});
// Connects after the first are held back so a test controls the order in
// which racing connects settle.
const buildDeferredClients = (t) => {
	const clients = [];
	const connects = [];
	const client = t.mock.fn(() => {
		const created = {
			end: t.mock.fn(async () => {}),
			mark: `client-${clients.length + 1}`,
		};
		clients.push(created);
		if (clients.length === 1) return created;
		return new Promise((resolve, reject) => {
			connects.push({ resolve: () => resolve(created), reject });
		});
	});
	return { client, clients, connects };
};

const durableContext = () => ({
	...newContext(),
	[Symbol.for("@aws/durable-execution-sdk-js/durable-context")]: true,
});

test("It should reconnect once when concurrent invocations both see a broken client", async (t) => {
	const { client, clients, connects } = buildDeferredClients(t);
	const seen = [];
	const handler = middy(() => {})
		.use(
			dsqlMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "dsql-broken-concurrent",
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			seen.push(request.context.middyContext.dsql);
		});
	await handler(defaultEvent, newContext());
	clients[0].broken = true;
	// Both invocations read the broken client from the cache before either
	// reconnect settles: the second must join the first reconnect rather than
	// start its own and race it for the cache entry.
	const inFlight = [
		handler(defaultEvent, newContext()),
		handler(defaultEvent, newContext()),
	];
	await flush();
	// Settle newest first, the order that left the cache holding a closed client.
	for (const connect of connects.reverse()) connect.resolve();
	await Promise.all(inFlight);
	strictEqual(clients.length, 2);
	strictEqual(seen[1], clients[1]);
	strictEqual(seen[2], clients[1]);
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 0);
	await handler(defaultEvent, newContext());
	strictEqual(seen[3], clients[1]);
	strictEqual(client.mock.callCount(), 2);
});

test("It should hand an invocation the client a refresh cached while its reconnect was in flight", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const { client, clients, connects } = buildDeferredClients(t);
	let captured;
	const handler = middy(() => {})
		.use(
			dsqlMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "dsql-reconnect-refreshed",
				cacheExpiry: 20,
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			captured = request.context.middyContext.dsql;
		});
	await handler(defaultEvent, newContext());
	clients[0].broken = true;
	const inFlight = handler(defaultEvent, newContext());
	await flush();
	strictEqual(clients.length, 2);
	// The refresh timer replaces the pending reconnect's cache entry with a
	// third connect, which settles first and becomes the cached client.
	t.mock.timers.tick(20);
	await flush();
	strictEqual(clients.length, 3);
	connects[1].resolve();
	await flush();
	connects[0].resolve();
	await inFlight;
	// The invocation uses the cached client; its own orphaned connect is closed
	// instead of the cached one.
	strictEqual(captured, clients[2]);
	strictEqual(clients[1].end.mock.callCount(), 1);
	strictEqual(clients[2].end.mock.callCount(), 0);
	await handler(defaultEvent, newContext());
	strictEqual(captured, clients[2]);
	strictEqual(clients[2].end.mock.callCount(), 0);
});

test("It should keep an invocation's own client when the connect that replaced it fails", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const { client, clients, connects } = buildDeferredClients(t);
	let captured;
	const handler = middy(() => {})
		.use(
			dsqlMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "dsql-reconnect-refresh-failed",
				cacheExpiry: 20,
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			captured = request.context.middyContext.dsql;
		});
	await handler(defaultEvent, newContext());
	clients[0].broken = true;
	const inFlight = handler(defaultEvent, newContext());
	await flush();
	t.mock.timers.tick(20);
	await flush();
	strictEqual(clients.length, 3);
	// The invocation's own reconnect settles while the refresh's connect is
	// still pending; that connect then fails, so the invocation keeps its own.
	connects[0].resolve();
	await flush();
	connects[1].reject(new Error("connect refused"));
	await flush();
	await inFlight;
	strictEqual(captured, clients[1]);
	strictEqual(clients[1].end.mock.callCount(), 0);
	// The failed refresh dropped the cache entry, so the next invocation
	// reconnects and retires the kept client once nothing holds it.
	const next = handler(defaultEvent, newContext());
	await flush();
	connects[2].resolve();
	await next;
	strictEqual(captured, clients[3]);
	strictEqual(clients[1].end.mock.callCount(), 1);
	strictEqual(clients[3].end.mock.callCount(), 0);
});

test("It should close a client that is already broken when built with cacheExpiry 0", async (t) => {
	const clients = [];
	const client = t.mock.fn(() => {
		const created = {
			end: t.mock.fn(async () => {}),
			broken: clients.length === 0,
		};
		clients.push(created);
		return created;
	});
	let captured;
	const handler = middy(() => {})
		.use(
			dsqlMiddleware({
				client,
				config: { host: validHost },
				cacheExpiry: 0,
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			captured = request.context.middyContext.dsql;
		});
	await handler(defaultEvent, newContext());
	strictEqual(clients.length, 2);
	strictEqual(captured, clients[1]);
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 1);
});

test("It should close each retired client once its own holder releases while newer clients stay leased", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const { client, clients } = buildClients(t);
	const gates = [];
	const handler = middy(
		() => new Promise((resolve) => gates.push(resolve)),
	).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "dsql-overlapping-leases",
			cacheExpiry: 20,
			disablePrefetch: true,
		}),
	);
	const open = () => clients.filter((c) => c.end.mock.callCount() === 0).length;
	const start = async () => {
		const done = handler(defaultEvent, newContext());
		await flush();
		return { done };
	};
	const refresh = async () => {
		t.mock.timers.tick(20);
		await flush();
	};
	const finish = async ({ done }) => {
		gates.shift()();
		await done;
		await flush();
	};

	// A host that is never idle: each invocation overlaps the next, so the
	// number of leases never drops to zero. A retired client must still close
	// as soon as the invocation holding it finishes.
	let previous = await start();
	for (let cycle = 1; cycle <= 3; cycle++) {
		await refresh();
		strictEqual(clients.length, cycle + 1);
		strictEqual(open(), 2);
		const current = await start();
		await finish(previous);
		strictEqual(clients[cycle - 1].end.mock.callCount(), 1);
		strictEqual(open(), 1);
		previous = current;
	}
	await finish(previous);
	strictEqual(clients[3].end.mock.callCount(), 0);
	strictEqual(open(), 1);
});

test("It should close a cacheExpiry 0 client left open by a durable invocation that threw", async (t) => {
	const { client, clients } = buildClients(t);
	let fail = true;
	const handler = middy(() => {
		if (fail) throw new Error("boom");
	}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	// Durable execution skips onError, so nothing ends the client here.
	await rejects(handler(defaultEvent, durableContext()), /boom/);
	strictEqual(clients[0].end.mock.callCount(), 0);
	fail = false;
	// The next invocation on the same execution environment closes it.
	await handler(defaultEvent, durableContext());
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 1);
});

test("It should release a lease abandoned by a durable invocation so a retired client closes", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const { client, clients } = buildClients(t);
	let fail = true;
	const handler = middy(() => {
		if (fail) throw new Error("boom");
	}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "dsql-durable-lease",
			cacheExpiry: 20,
			disablePrefetch: true,
		}),
	);
	await rejects(handler(defaultEvent, durableContext()), /boom/);
	// The refresh retires client 1, but the abandoned lease keeps it open.
	t.mock.timers.tick(20);
	await flush();
	strictEqual(clients.length, 2);
	strictEqual(clients[0].end.mock.callCount(), 0);
	fail = false;
	await handler(defaultEvent, durableContext());
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 0);
});

test("It should keep a retired client open until every invocation holding it completes", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const { client, clients } = buildClients(t);
	const gates = [];
	const handler = middy(
		() => new Promise((resolve) => gates.push(resolve)),
	).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "dsql-shared-lease",
			cacheExpiry: 20,
			disablePrefetch: true,
		}),
	);
	// Two invocations hold the same client when a refresh retires it.
	const first = handler(defaultEvent, newContext());
	const second = handler(defaultEvent, newContext());
	await flush();
	strictEqual(clients.length, 1);
	t.mock.timers.tick(20);
	await flush();
	strictEqual(clients.length, 2);
	// The first holder finishing must not close a client the second still
	// runs a query on; only the last release closes it.
	gates.shift()();
	await first;
	await flush();
	strictEqual(clients[0].end.mock.callCount(), 0);
	gates.shift()();
	await second;
	await flush();
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 0);
});

test("It should leave in-flight leases alone outside durable execution", async (t) => {
	const { client, clients } = buildClients(t);
	const gates = [];
	const handler = middy(
		() => new Promise((resolve) => gates.push(resolve)),
	).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	const first = handler(defaultEvent, newContext());
	await flush();
	// Standard invocations run concurrently, so a new one starting must not
	// treat the running one's lease as abandoned and end its client.
	const second = handler(defaultEvent, newContext());
	await flush();
	strictEqual(clients.length, 2);
	strictEqual(clients[0].end.mock.callCount(), 0);
	gates.shift()();
	await first;
	strictEqual(clients[0].end.mock.callCount(), 1);
	gates.shift()();
	await second;
	strictEqual(clients[1].end.mock.callCount(), 1);
});

test("It should reclaim only the leases a durable invocation abandoned", async (t) => {
	const { client, clients } = buildClients(t);
	const handler = middy(() => {}).use(
		dsqlMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	await handler(defaultEvent, durableContext());
	strictEqual(clients[0].end.mock.callCount(), 1);
	// A completed invocation released its own lease, so the next one must not
	// end its client a second time.
	await handler(defaultEvent, durableContext());
	strictEqual(clients[0].end.mock.callCount(), 1);
	strictEqual(clients[1].end.mock.callCount(), 1);
});

test("It should keep the cached client open when reclaiming a lease a durable invocation abandoned", async (t) => {
	const { client, clients } = buildClients(t);
	let fail = true;
	let captured;
	const handler = middy(() => {
		if (fail) throw new Error("boom");
	})
		.use(
			dsqlMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "dsql-durable-cached",
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			captured = request.context.middyContext.dsql;
		});
	await rejects(handler(defaultEvent, durableContext()), /boom/);
	fail = false;
	// The abandoned lease is released, but the client is still the cached one
	// and is handed to this invocation, so it must stay open.
	await handler(defaultEvent, durableContext());
	strictEqual(captured, clients[0]);
	strictEqual(clients.length, 1);
	strictEqual(clients[0].end.mock.callCount(), 0);
});

test("It should keep an invocation's own client when the connect that replaced it failed first", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const { client, clients, connects } = buildDeferredClients(t);
	let captured;
	const handler = middy(() => {})
		.use(
			dsqlMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "dsql-reconnect-refresh-failed-first",
				cacheExpiry: 20,
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			captured = request.context.middyContext.dsql;
		});
	await handler(defaultEvent, newContext());
	clients[0].broken = true;
	const inFlight = handler(defaultEvent, newContext());
	await flush();
	t.mock.timers.tick(20);
	await flush();
	strictEqual(clients.length, 3);
	// The refresh's connect fails (dropping the cache entry) before the
	// invocation's own reconnect settles, so nothing owns the cache when it
	// does and the invocation keeps its own client.
	connects[1].reject(new Error("connect refused"));
	await flush();
	connects[0].resolve();
	await inFlight;
	strictEqual(captured, clients[1]);
	strictEqual(clients[1].end.mock.callCount(), 0);
	// The next invocation reconnects and retires the kept client.
	const next = handler(defaultEvent, newContext());
	await flush();
	connects[2].resolve();
	await next;
	strictEqual(captured, clients[3]);
	strictEqual(clients[1].end.mock.callCount(), 1);
	strictEqual(clients[3].end.mock.callCount(), 0);
});
