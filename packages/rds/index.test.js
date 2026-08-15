import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { clearCache, processCache } from "@middy/util";
import middy from "../core/index.js";
import rdsSigner from "../rds-signer/index.js";
import rdsMiddleware, { rdsValidateOptions } from "./index.js";

test.afterEach(() => {
	clearCache();
});

const defaultEvent = {};
const newContext = () => ({
	getRemainingTimeInMillis: () => 1000,
});

const validHost = "db.cluster-abc.us-east-1.rds.amazonaws.com";
const pkgKey = "@middy/rds";

const buildClient = (t, { client, end } = {}) => {
	const endFn = end ?? t.mock.fn(async () => {});
	const clientFn = client ?? t.mock.fn(() => ({ end: endFn, mark: "client" }));
	return { client: clientFn, end: endFn };
};

test("It should instantiate the client and attach it to context", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {}).use(
		rdsMiddleware({
			client,
			config: { host: validHost, username: "admin" },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);

	let captured;
	handler.before(async (request) => {
		captured = request.context.rds;
	});

	await handler(defaultEvent, newContext());
	strictEqual(client.mock.callCount(), 1);
	strictEqual(captured?.mark, "client");
});

test("It should pass config straight to the client function", async (t) => {
	const { client } = buildClient(t);
	const config = {
		host: validHost,
		username: "admin",
		database: "postgres",
		port: 5432,
	};
	const handler = middy(() => {}).use(
		rdsMiddleware({
			client,
			config,
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	await handler(defaultEvent, newContext());
	strictEqual(client.mock.calls[0].arguments[0], config);
});

test("It should honour custom contextKey", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {}).use(
		rdsMiddleware({
			client,
			config: { host: validHost },
			contextKey: "db",
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);

	let captured;
	handler.before(async (request) => {
		captured = { rds: request.context.rds, db: request.context.db };
	});

	await handler(defaultEvent, newContext());
	strictEqual(captured.rds, undefined);
	strictEqual(captured.db?.mark, "client");
});

test("It should merge token from internalKey into config.password", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {})
		.before(async (request) => {
			request.internal.rdsToken = "iam-token-abc";
		})
		.use(
			rdsMiddleware({
				client,
				config: { host: validHost, username: "admin" },
				internalKey: "rdsToken",
				cacheExpiry: 0,
				disablePrefetch: true,
			}),
		);

	await handler(defaultEvent, newContext());
	const arg = client.mock.calls[0].arguments[0];
	strictEqual(arg.password, "iam-token-abc");
	strictEqual(arg.host, validHost);
	strictEqual(arg.username, "admin");
});

test("It should resolve a Promise-valued internalKey token before passing it as password", async (t) => {
	// @middy/rds-signer stores the auth token in request.internal as an UNRESOLVED
	// Promise (it never awaits getAuthToken). Per the middy contract, consumers must
	// resolve internal values via getInternal(); reading request.internal[key] raw
	// yields the Promise itself. Passing that Promise to pg as `password` triggers a
	// SASL "client password must be a string" error, so @middy/rds must resolve it.
	const { client } = buildClient(t);
	const handler = middy(() => {})
		.before(async (request) => {
			request.internal.rdsToken = Promise.resolve("iam-token-abc");
		})
		.use(
			rdsMiddleware({
				client,
				config: { host: validHost, username: "admin" },
				internalKey: "rdsToken",
				cacheExpiry: 0,
				disablePrefetch: true,
			}),
		);

	await handler(defaultEvent, newContext());
	const arg = client.mock.calls[0].arguments[0];
	strictEqual(arg.password, "iam-token-abc");
	strictEqual(arg.host, validHost);
	strictEqual(arg.username, "admin");
});

test("It should resolve the real @middy/rds-signer token end-to-end (integration)", async (t) => {
	// The real signer contract: rds-signer stores getAuthToken()'s result in
	// request.internal as an unresolved Promise; rds must resolve it into password.
	const authToken =
		"https://db.example.rds.amazonaws.com:5432/?Action=connect&X-Amz-Security-Token=abc";
	const getAuthToken = t.mock.fn(async () => authToken);
	class AwsClient {
		getAuthToken = getAuthToken;
	}
	const { client } = buildClient(t);
	const handler = middy(() => {})
		.use(
			rdsSigner({
				AwsClient,
				cacheExpiry: 0,
				disablePrefetch: true,
				fetchData: {
					rdsToken: {
						hostname: "db.example.rds.amazonaws.com",
						port: 5432,
						username: "admin",
						region: "us-east-1",
					},
				},
			}),
		)
		.use(
			rdsMiddleware({
				client,
				config: { host: validHost, username: "admin" },
				internalKey: "rdsToken",
				cacheExpiry: 0,
				disablePrefetch: true,
			}),
		);

	await handler(defaultEvent, newContext());
	strictEqual(getAuthToken.mock.callCount(), 1);
	strictEqual(client.mock.calls[0].arguments[0].password, authToken);
});

test("It should surface a rejected internalKey token as an error instead of building a client with it", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {})
		.before(async (request) => {
			// rds-signer stores a rejected Promise when getAuthToken fails; getInternal
			// must surface that error rather than hand the rejected Promise to the
			// client as `password`.
			const rejected = Promise.reject(new Error("signer boom"));
			rejected.catch(() => {}); // pre-silence the standalone warning, as processCache does
			request.internal.rdsToken = rejected;
		})
		.use(
			rdsMiddleware({
				client,
				config: { host: validHost },
				internalKey: "rdsToken",
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
	strictEqual(client.mock.callCount(), 0);
});

test("It should throw when internalKey is set but token is missing", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {}).use(
		rdsMiddleware({
			client,
			config: { host: validHost },
			internalKey: "rdsToken",
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
	strictEqual(captured.cause?.package, "@middy/rds");
});

test("It should call end() on after when cacheExpiry is 0", async (t) => {
	const { client, end } = buildClient(t);
	const handler = middy(() => {}).use(
		rdsMiddleware({
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
		rdsMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: -1,
			cacheKey: "rds-no-end-test",
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
		rdsMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	await handler(defaultEvent, newContext());
	strictEqual(end.mock.callCount(), 1);
});

test("It should run cleanup on onError too", async (t) => {
	const { client, end } = buildClient(t);
	const handler = middy(() => {
		throw new Error("boom");
	}).use(
		rdsMiddleware({
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
		rdsMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "rds-reuse-test",
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
		rdsMiddleware({
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
		rdsMiddleware({
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
		config: { host: validHost },
		cacheKey: "rds-refresh",
		cacheExpiry: -1,
	};
	const handler = middy(() => {}).use(rdsMiddleware(opts));
	let captured;
	handler.before(async (request) => {
		captured = request.context.rds;
	});
	await handler(defaultEvent, newContext());
	strictEqual(captured.mark, "client-1");
	// Rebuild the shared cache with a fresh client, as the auto-refresh timer would
	clearCache();
	processCache({ ...opts }, () => client());
	await handler(defaultEvent, newContext());
	strictEqual(captured.mark, "client-2");
});

test("It should default cacheExpiry to 0 when internalKey is set so a rotated token is re-read", async (t) => {
	const end = t.mock.fn(async () => {});
	const client = t.mock.fn((cfg) => ({ end, password: cfg.password }));
	let token = "token-1";
	const handler = middy(() => {})
		.before(async (request) => {
			request.internal.rdsToken = token;
		})
		.use(
			rdsMiddleware({
				client,
				config: { host: validHost, username: "admin" },
				internalKey: "rdsToken",
				cacheKey: "rds-rotate",
			}),
		);
	await handler(defaultEvent, newContext());
	strictEqual(client.mock.calls[0].arguments[0].password, "token-1");
	token = "token-2";
	await handler(defaultEvent, newContext());
	strictEqual(client.mock.callCount(), 2);
	strictEqual(client.mock.calls[1].arguments[0].password, "token-2");
	strictEqual(end.mock.callCount(), 2);
});

test("It should honour an explicit cacheExpiry over the internalKey default", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {})
		.before(async (request) => {
			request.internal.rdsToken = "iam-token";
		})
		.use(
			rdsMiddleware({
				client,
				config: { host: validHost, username: "admin" },
				internalKey: "rdsToken",
				cacheExpiry: -1,
				cacheKey: "rds-explicit-expiry",
			}),
		);
	await handler(defaultEvent, newContext());
	await handler(defaultEvent, newContext());
	strictEqual(client.mock.callCount(), 1);
});

test("It should throw if client option is missing", () => {
	try {
		rdsMiddleware({ config: { host: validHost } });
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.message, "client option missing");
		strictEqual(e.cause?.package, "@middy/rds");
	}
});

test("It should throw if client is not a function", () => {
	try {
		rdsMiddleware({ client: {}, config: { host: validHost } });
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.message, "client must be a function");
		strictEqual(e.cause?.package, "@middy/rds");
	}
});

test("rdsValidateOptions accepts a minimal valid config", () => {
	rdsValidateOptions({
		client: () => ({}),
		config: { host: validHost },
	});
});

test("rdsValidateOptions accepts the full surface", () => {
	rdsValidateOptions({
		client: () => ({}),
		config: {
			host: validHost,
			username: "admin",
			database: "postgres",
			port: 5432,
		},
		contextKey: "rds",
		internalKey: "rdsToken",
		disablePrefetch: false,
		cacheKey: "k",
		cacheKeyExpiry: { k: 60_000 },
		cacheExpiry: -1,
	});
});

test("rdsValidateOptions rejects unknown options (typo guard)", () => {
	try {
		rdsValidateOptions({
			client: () => ({}),
			config: { host: validHost },
			cachExpiry: 60,
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/rds");
	}
});

test("rdsValidateOptions rejects missing host", () => {
	try {
		rdsValidateOptions({
			client: () => ({}),
			config: { username: "admin" },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("rdsValidateOptions rejects missing client", () => {
	try {
		rdsValidateOptions({ config: { host: validHost } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("rdsValidateOptions rejects non-function client", () => {
	try {
		rdsValidateOptions({
			client: "nope",
			config: { host: validHost },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("rdsValidateOptions rejects out-of-range port", () => {
	try {
		rdsValidateOptions({
			client: () => ({}),
			config: { host: validHost, port: 99999 },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("rdsValidateOptions allows unknown extra config properties (pg passthrough)", () => {
	// config.additionalProperties is true so arbitrary pg client options pass.
	rdsValidateOptions({
		client: () => ({}),
		config: {
			host: validHost,
			connectionTimeoutMillis: 3000,
			statement_timeout: 1000,
		},
	});
});

test("rdsValidateOptions accepts a cacheKeyExpiry value of -1 (infinite)", () => {
	// cacheKeyExpiry additionalProperties minimum is -1, so -1 is in range.
	rdsValidateOptions({
		client: () => ({}),
		config: { host: validHost },
		cacheKeyExpiry: { [pkgKey]: -1 },
	});
});

test("rdsValidateOptions rejects a cacheKeyExpiry value below -1", () => {
	try {
		rdsValidateOptions({
			client: () => ({}),
			config: { host: validHost },
			cacheKeyExpiry: { [pkgKey]: -2 },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("It should prefetch the client at construction time by default", (t) => {
	// disablePrefetch defaults to false and cacheExpiry defaults to -1, so
	// canPrefetch is true and the client is built immediately, before any invoke.
	const { client } = buildClient(t);
	rdsMiddleware({
		client,
		config: { host: validHost },
		cacheKey: "rds-prefetch-construct",
	});
	strictEqual(client.mock.callCount(), 1);
});

test("It should NOT prefetch at construction when disablePrefetch is true", (t) => {
	const { client } = buildClient(t);
	rdsMiddleware({
		client,
		config: { host: validHost },
		disablePrefetch: true,
		cacheKey: "rds-no-prefetch-construct",
	});
	strictEqual(client.mock.callCount(), 0);
});

test("It should NOT prefetch at construction when internalKey is set", (t) => {
	// internalKey needs a per-request token, so prefetch is skipped even though
	// canPrefetch would otherwise be true (cacheExpiry defaults to 0 here).
	const { client } = buildClient(t);
	rdsMiddleware({
		client,
		config: { host: validHost },
		internalKey: "rdsToken",
		cacheKey: "rds-internalkey-no-prefetch",
	});
	strictEqual(client.mock.callCount(), 0);
});

test("It should cache forever by default (cacheExpiry -1) and reuse across invokes", async (t) => {
	// Relies on the default cacheExpiry being -1 (infinite). If it were +1ms the
	// entry would expire between invocations and the client would be rebuilt.
	const { client } = buildClient(t);
	const handler = middy(() => {}).use(
		rdsMiddleware({
			client,
			config: { host: validHost },
			cacheKey: "rds-default-expiry-reuse",
		}),
	);
	await handler(defaultEvent, newContext());
	await new Promise((resolve) => setTimeout(resolve, 5));
	await handler(defaultEvent, newContext());
	strictEqual(client.mock.callCount(), 1);
});

test("It should throw the documented internalKey-not-found message", async (t) => {
	const { client } = buildClient(t);
	const handler = middy(() => {}).use(
		rdsMiddleware({
			client,
			config: { host: validHost },
			internalKey: "rdsToken",
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
	strictEqual(
		captured.message,
		"internalKey 'rdsToken' not found; ensure @middy/rds-signer runs before @middy/rds",
	);
});

test("It should throw the not-found error (not a TypeError) when request.internal is absent", async (t) => {
	// Exercises both optional chains in request?.internal?.[internalKey]. With no
	// `internal` property present, the real code short-circuits to the documented
	// not-found Error. Dropping either chain would instead throw a TypeError when
	// reading a property of undefined, so asserting the exact message + non-Type-
	// Error kills both OptionalChaining mutants on this line.
	const { client } = buildClient(t);
	const mw = rdsMiddleware({
		client,
		config: { host: validHost },
		internalKey: "rdsToken",
		cacheExpiry: 0,
		disablePrefetch: true,
	});
	// request.internal undefined -> exercises the second `?.` (internal?.[key])
	let captured;
	try {
		await mw.before({ context: {} });
	} catch (e) {
		captured = e;
	}
	ok(captured);
	ok(!(captured instanceof TypeError), "should not be a TypeError");
	strictEqual(
		captured.message,
		"internalKey 'rdsToken' not found; ensure @middy/rds-signer runs before @middy/rds",
	);
	strictEqual(captured.cause?.package, "@middy/rds");

	// request itself nullish -> exercises the first `?.` (request?.internal). The
	// fetch thunk ignores the cache-supplied request and closes over `null`, so
	// buildConfig(null) must still surface the not-found Error, not a TypeError.
	let capturedNull;
	try {
		await mw.before(null);
	} catch (e) {
		capturedNull = e;
	}
	ok(capturedNull);
	ok(!(capturedNull instanceof TypeError), "should not be a TypeError");
	strictEqual(
		capturedNull.message,
		"internalKey 'rdsToken' not found; ensure @middy/rds-signer runs before @middy/rds",
	);
});

test("It should log a cleanup error with the package-prefixed format", async (t) => {
	const errors = [];
	const original = console.error;
	console.error = (...args) => {
		errors.push(args);
	};
	const end = t.mock.fn(async () => {
		throw new Error("end boom");
	});
	const { client } = buildClient(t, { end });
	const handler = middy(() => {}).use(
		rdsMiddleware({
			client,
			config: { host: validHost },
			cacheExpiry: 0,
			disablePrefetch: true,
		}),
	);
	try {
		await handler(defaultEvent, newContext());
	} finally {
		console.error = original;
	}
	strictEqual(errors.length, 1);
	strictEqual(errors[0][0], "%s: cleanup error: %s");
	strictEqual(errors[0][1], "@middy/rds");
	strictEqual(errors[0][2], "end boom");
});
