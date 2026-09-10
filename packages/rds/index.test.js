import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
import { describe, test } from "node:test";
import { clearCache, processCache, setContextNamespace } from "@middy/util";
import middy from "../core/index.js";
import rdsSigner from "../rds-signer/index.js";
import rdsMiddleware, { rdsValidateOptions } from "./index.js";

describe("@middy/rds", () => {
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
		const clientFn =
			client ?? t.mock.fn(() => ({ end: endFn, mark: "client" }));
		return { client: clientFn, end: endFn };
	};

	test("It should tolerate an explicit cacheKeyExpiry: undefined", async (t) => {
		// `{ ...defaults, ...opts }` lets an explicit undefined override the `{}`
		// default, so the per-key lookup must not assume the map exists.
		const { client, end } = buildClient(t);
		const handler = middy(() => {}).use(
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheExpiry: 0,
				cacheKeyExpiry: undefined,
				disablePrefetch: true,
			}),
		);
		await handler(defaultEvent, newContext());
		strictEqual(client.mock.callCount(), 1);
		strictEqual(end.mock.callCount(), 1);
	});

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
			captured = request.context.middyContext.rds;
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
			captured = {
				rds: request.context.middyContext.rds,
				db: request.context.middyContext.db,
			};
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
			captured = request.context.middyContext.rds;
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

	test("rdsValidateOptions validates contextKey as a string", () => {
		// Pins the rule itself: an empty `{}` rule would accept the number below,
		// and a blank `type` would reject the valid string above.
		const client = () => {};
		const config = { host: validHost, username: "admin" };
		rdsValidateOptions({ client, config, contextKey: "custom" });
		try {
			rdsValidateOptions({ client, config, contextKey: 123 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("contextKey"));
		}
	});

	test("It should not report a cleanup error when middyContext is absent", async (t) => {
		const { client } = buildClient(t);
		const middleware = rdsMiddleware({
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

	test("It should not cache a rejected connection so the next invocation reconnects", async (t) => {
		let attempt = 0;
		const client = t.mock.fn(async () => {
			attempt += 1;
			if (attempt === 1) throw new Error("connect refused");
			return { end: async () => {}, mark: "client" };
		});
		const handler = middy(() => {}).use(
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-reconnect",
				disablePrefetch: true,
			}),
		);
		await rejects(() => handler(defaultEvent, newContext()), /connect refused/);
		await handler(defaultEvent, newContext());
		await handler(defaultEvent, newContext());
		strictEqual(client.mock.callCount(), 2);
	});

	test("It should reconnect when the cached client is flagged broken", async (t) => {
		const { client, clients } = buildClients(t);
		const handler = middy(() => {}).use(
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-broken",
				disablePrefetch: true,
			}),
		);
		let captured;
		handler.before(async (request) => {
			captured = request.context.middyContext.rds;
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

	test("It should close a client replaced by a cache refresh, but not the live one", async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		const { client, clients } = buildClients(t);
		const handler = middy(() => {}).use(
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-refresh-close",
				cacheExpiry: 20,
				disablePrefetch: true,
			}),
		);
		let captured;
		handler.before(async (request) => {
			captured = request.context.middyContext.rds;
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
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-refresh-deferred",
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
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-failed-lease",
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
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-refresh-close-error",
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
			"@middy/rds",
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
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-refresh-fail",
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
				rdsMiddleware({
					client,
					config: { host: validHost },
					cacheKey: "rds-broken-concurrent",
					disablePrefetch: true,
				}),
			)
			.before(async (request) => {
				seen.push(request.context.middyContext.rds);
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
				rdsMiddleware({
					client,
					config: { host: validHost },
					cacheKey: "rds-reconnect-refreshed",
					cacheExpiry: 20,
					disablePrefetch: true,
				}),
			)
			.before(async (request) => {
				captured = request.context.middyContext.rds;
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
				rdsMiddleware({
					client,
					config: { host: validHost },
					cacheKey: "rds-reconnect-refresh-failed",
					cacheExpiry: 20,
					disablePrefetch: true,
				}),
			)
			.before(async (request) => {
				captured = request.context.middyContext.rds;
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
				rdsMiddleware({
					client,
					config: { host: validHost },
					cacheExpiry: 0,
					disablePrefetch: true,
				}),
			)
			.before(async (request) => {
				captured = request.context.middyContext.rds;
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
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-overlapping-leases",
				cacheExpiry: 20,
				disablePrefetch: true,
			}),
		);
		const open = () =>
			clients.filter((c) => c.end.mock.callCount() === 0).length;
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
			rdsMiddleware({
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
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-durable-lease",
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
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-shared-lease",
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
			rdsMiddleware({
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
			rdsMiddleware({
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
				rdsMiddleware({
					client,
					config: { host: validHost },
					cacheKey: "rds-durable-cached",
					disablePrefetch: true,
				}),
			)
			.before(async (request) => {
				captured = request.context.middyContext.rds;
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
				rdsMiddleware({
					client,
					config: { host: validHost },
					cacheKey: "rds-reconnect-refresh-failed-first",
					cacheExpiry: 20,
					disablePrefetch: true,
				}),
			)
			.before(async (request) => {
				captured = request.context.middyContext.rds;
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

	test("It should honour cacheKeyExpiry -1 over cacheExpiry 0 and keep one client open", async (t) => {
		const { client, end } = buildClient(t);
		const handler = middy(() => {}).use(
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-keyexpiry-infinite",
				cacheKeyExpiry: { "rds-keyexpiry-infinite": -1 },
				cacheExpiry: 0,
				disablePrefetch: true,
			}),
		);
		await handler(defaultEvent, newContext());
		await handler(defaultEvent, newContext());
		await handler(defaultEvent, newContext());
		strictEqual(client.mock.callCount(), 1);
		strictEqual(end.mock.callCount(), 0);
	});

	test("It should honour cacheKeyExpiry 0 over cacheExpiry -1 and close per invocation", async (t) => {
		const { client, end } = buildClient(t);
		const handler = middy(() => {}).use(
			rdsMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "rds-keyexpiry-zero",
				cacheKeyExpiry: { "rds-keyexpiry-zero": 0 },
				cacheExpiry: -1,
			}),
		);
		// The per-key expiry disables caching, so nothing is prefetched either.
		strictEqual(client.mock.callCount(), 0);
		await handler(defaultEvent, newContext());
		strictEqual(end.mock.callCount(), 1);
		await handler(defaultEvent, newContext());
		await handler(defaultEvent, newContext());
		strictEqual(client.mock.callCount(), 3);
		strictEqual(end.mock.callCount(), 3);
	});

	test("It should not refresh a token-authenticated connection in the background", async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		const { client } = buildClient(t);
		let token = "token-1";
		const handler = middy(() => {})
			.before(async (request) => {
				request.internal.rdsToken = token;
			})
			.use(
				rdsMiddleware({
					client,
					config: { host: validHost },
					internalKey: "rdsToken",
					cacheKey: "rds-token-refresh",
					cacheExpiry: 20,
					disablePrefetch: true,
				}),
			);
		await handler(defaultEvent, newContext());
		// The entry expires without a background reconnect, which could only
		// replay the token of the invocation that stored it; the next invocation
		// reconnects with its own.
		token = "token-2";
		t.mock.timers.tick(25);
		await flush();
		strictEqual(client.mock.callCount(), 1);
		await handler(defaultEvent, newContext());
		token = "token-3";
		t.mock.timers.tick(25);
		await flush();
		await handler(defaultEvent, newContext());
		deepStrictEqual(
			client.mock.calls.map((call) => call.arguments[0].password),
			["token-1", "token-2", "token-3"],
		);
	});

	test("It should keep a refreshed entry when the reconnect it replaced fails", async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		const { client, clients, connects } = buildDeferredClients(t);
		let captured;
		const handler = middy(() => {})
			.use(
				rdsMiddleware({
					client,
					config: { host: validHost },
					cacheKey: "rds-stale-reject",
					cacheExpiry: 20,
					disablePrefetch: true,
				}),
			)
			.before(async (request) => {
				captured = request.context.middyContext.rds;
			});
		await handler(defaultEvent, newContext());
		clients[0].broken = true;
		const inFlight = handler(defaultEvent, newContext());
		await flush();
		t.mock.timers.tick(20);
		await flush();
		strictEqual(clients.length, 3);
		// The refresh replaced the cache entry while the invocation's reconnect
		// was in flight. That reconnect failing must drop only itself, not the
		// refresh's entry, or the next invocation reconnects for nothing.
		connects[0].reject(new Error("connect refused"));
		await rejects(inFlight, /connect refused/);
		connects[1].resolve();
		await flush();
		const next = handler(defaultEvent, newContext());
		await flush();
		strictEqual(clients.length, 3);
		await next;
		strictEqual(captured, clients[2]);
	});

	test("It should not log a cleanup error when a cacheExpiry 0 connect fails beside another namespace", async (t) => {
		const client = t.mock.fn(async () => {
			throw new Error("connect refused");
		});
		const handler = middy(() => {})
			.before((request) => {
				setContextNamespace(request, "other", {});
			})
			.use(
				rdsMiddleware({
					client,
					config: { host: validHost },
					cacheExpiry: 0,
					disablePrefetch: true,
				}),
			);
		const logged = [];
		const originalError = console.error;
		console.error = (...args) => logged.push(args);
		try {
			await rejects(
				() => handler(defaultEvent, newContext()),
				/connect refused/,
			);
		} finally {
			console.error = originalError;
		}
		deepStrictEqual(logged, []);
	});
});
