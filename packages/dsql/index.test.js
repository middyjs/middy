import {
	deepStrictEqual,
	ok,
	rejects,
	strictEqual,
	throws,
} from "node:assert/strict";
import { createServer } from "node:net";
import { describe, test } from "node:test";
import middy from "@middy/core";
import {
	clearCache,
	getCache,
	processCache,
	setContextNamespace,
} from "@middy/util";
import clientPg from "./clientPg.js";
import clientPgPool from "./clientPgPool.js";
import clientPostgres from "./clientPostgres.js";
import dsqlMiddleware, { dsqlValidateOptions } from "./index.js";

const startAuthServer = async () => {
	const passwords = [];
	const message = (type, body) => {
		const head = Buffer.alloc(5);
		head.write(type);
		head.writeInt32BE(4 + body.length, 1);
		return Buffer.concat([head, body]);
	};
	const int32 = (value) => {
		const buffer = Buffer.alloc(4);
		buffer.writeInt32BE(value);
		return buffer;
	};
	const AuthenticationOk = 0;
	const AuthenticationCleartextPassword = 3;
	const readyForQuery = message("Z", Buffer.from("I"));
	const sockets = new Set();
	const server = createServer((socket) => {
		let buffered = Buffer.alloc(0);
		let started = false;
		sockets.add(socket);
		socket.on("close", () => sockets.delete(socket));
		socket.on("error", () => {});
		socket.on("data", (chunk) => {
			buffered = Buffer.concat([buffered, chunk]);
			while (true) {
				if (!started) {
					// The startup message has no type byte, only a length.
					if (buffered.length < 4) return;
					const length = buffered.readInt32BE(0);
					if (buffered.length < length) return;
					buffered = buffered.subarray(length);
					started = true;
					socket.write(message("R", int32(AuthenticationCleartextPassword)));
					continue;
				}
				if (buffered.length < 5) return;
				const end = 1 + buffered.readInt32BE(1);
				if (buffered.length < end) return;
				const type = String.fromCharCode(buffered[0]);
				const body = buffered.subarray(5, end);
				buffered = buffered.subarray(end);
				if (type === "p") {
					passwords.push(body.toString("utf8", 0, body.length - 1));
					socket.write(message("R", int32(AuthenticationOk)));
					socket.write(readyForQuery);
				} else if (type === "Q") {
					socket.write(message("C", Buffer.from("SELECT 0\0")));
					socket.write(readyForQuery);
				} else if (type === "X") {
					socket.end();
				}
			}
		});
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	return {
		passwords,
		port: server.address().port,
		close: () => {
			for (const socket of sockets) socket.destroy();
			return new Promise((resolve) => server.close(resolve));
		},
	};
};

describe("@middy/dsql", () => {
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
		const clientFn =
			client ?? t.mock.fn(() => ({ end: endFn, mark: "client" }));
		return { client: clientFn, end: endFn };
	};

	const buildTokenClient = (t) => {
		const presented = [];
		const end = t.mock.fn(async () => {});
		const client = t.mock.fn((config) => {
			presented.push(config.password());
			return { end };
		});
		return { client, end, presented };
	};

	test("It should tolerate an explicit cacheKeyExpiry: undefined", async (t) => {
		// `{ ...defaults, ...opts }` lets an explicit undefined override the `{}`
		// default, so the per-key lookup must not assume the map exists.
		const { client, end } = buildClient(t);
		const handler = middy(() => {}).use(
			dsqlMiddleware({
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

	test("It should not end the outer request's client when a nested middy fails to connect", async (t) => {
		const outerDsql = buildClient(t);
		const inner = middy(() => {}).use(
			dsqlMiddleware({
				client: () => {
					throw new Error("connect failed");
				},
				config: { host: validHost },
				cacheExpiry: 0,
				cacheKey: "dsql-inner",
				disablePrefetch: true,
			}),
		);
		let endedDuringInner;
		const handler = middy(async (event, context) => {
			await rejects(inner(event, context), { message: "connect failed" });
			endedDuringInner = outerDsql.end.mock.callCount();
		}).use(
			dsqlMiddleware({
				client: outerDsql.client,
				config: { host: validHost },
				cacheExpiry: 0,
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, newContext());
		strictEqual(endedDuringInner, 0);
		strictEqual(outerDsql.end.mock.callCount(), 1);
	});

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
		deepStrictEqual(client.mock.calls[0].arguments[0], {
			ssl: true,
			...config,
		});
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

	const privateLinkEndpointHosts = [
		"vpce-04037adb76c111221-d849uc2p.dsql-fnh4.us-east-1.vpce.amazonaws.com",
		"10.0.12.34",
		"fd00:ec2::1a2b",
	];

	test("It should refuse to default ssl for a PrivateLink endpoint domain name or IP address", (t) => {
		for (const host of privateLinkEndpointHosts) {
			const { client } = buildClient(t);
			throws(
				() => dsqlMiddleware({ client, config: { host, username: "admin" } }),
				(e) => {
					strictEqual(
						e.message,
						`config.ssl must be set: AWS PrivateLink endpoint domain names and IP addresses, such as '${host}', do not support the verify-full SSL mode, and connecting through one requires the amzn-cluster-id connection option; for verify-full, connect to the cluster's private DNS hostname, '{cluster-id}.{service-identifier}.{region}.on.aws'`,
					);
					deepStrictEqual(e.cause, { package: "@middy/dsql", data: { host } });
					return true;
				},
			);
			strictEqual(client.mock.callCount(), 0);
		}
	});

	test("It should pass the ssl the caller set for a PrivateLink endpoint domain name or IP address", async (t) => {
		for (const ssl of [false, { rejectUnauthorized: true, ca: "ca" }]) {
			for (const host of privateLinkEndpointHosts) {
				const { client } = buildClient(t);
				const handler = middy(() => {}).use(
					dsqlMiddleware({
						client,
						config: { host, ssl },
						cacheExpiry: 0,
						disablePrefetch: true,
					}),
				);
				await handler(defaultEvent, newContext());
				deepStrictEqual(client.mock.calls[0].arguments[0], { host, ssl });
			}
		}
	});

	test("It should default ssl to true for a PrivateLink cluster hostname", async (t) => {
		const { client } = buildClient(t);
		const host = "01abc2ldefg3hijklmnopqurstu.dsql-fnh4.us-east-1.on.aws";
		const handler = middy(() => {}).use(
			dsqlMiddleware({
				client,
				config: { host },
				cacheExpiry: 0,
				disablePrefetch: true,
			}),
		);
		await handler(defaultEvent, newContext());
		deepStrictEqual(client.mock.calls[0].arguments[0], { ssl: true, host });
	});

	test("It should hand the client a password function that returns the internalKey token", async (t) => {
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
		strictEqual(typeof arg.password, "function");
		strictEqual(arg.password(), "iam-token-abc");
		strictEqual(arg.host, validHost);
		strictEqual(arg.ssl, true);
	});

	test("It should present the latest invocation's token on every connection a cached pool opens", async (t) => {
		const presented = [];
		const client = t.mock.fn((config) => ({
			connect: () => presented.push(config.password()),
		}));
		let token = "token-1";
		const handler = middy((event, context) => {
			context.middyContext.dsql.connect();
		})
			.before((request) => {
				request.internal.dsqlToken = token;
			})
			.use(
				dsqlMiddleware({
					client,
					config: { host: validHost },
					internalKey: "dsqlToken",
					cacheExpiry: -1,
					cacheKey: "dsql-pool-token",
				}),
			);

		await handler(defaultEvent, newContext());
		token = "token-2";
		await handler(defaultEvent, newContext());

		strictEqual(client.mock.callCount(), 1);
		deepStrictEqual(presented, ["token-1", "token-2"]);
	});

	test("It should keep the default cacheExpiry of -1 when internalKey is set", async (t) => {
		const { client, end, presented } = buildTokenClient(t);
		let token = "token-1";
		const handler = middy(() => {})
			.before(async (request) => {
				request.internal.dsqlToken = token;
			})
			.use(
				dsqlMiddleware({
					client,
					config: { host: validHost, username: "admin" },
					internalKey: "dsqlToken",
					cacheKey: "dsql-rotate",
				}),
			);
		await handler(defaultEvent, newContext());
		token = "token-2";
		await handler(defaultEvent, newContext());
		strictEqual(client.mock.callCount(), 1);
		deepStrictEqual(presented, ["token-1"]);
		strictEqual(end.mock.callCount(), 0);
	});

	test("It should reconnect with each invocation's token when cacheExpiry is 0 and internalKey is set", async (t) => {
		const { client, end, presented } = buildTokenClient(t);
		let token = "token-1";
		const handler = middy(() => {})
			.before(async (request) => {
				request.internal.dsqlToken = token;
			})
			.use(
				dsqlMiddleware({
					client,
					config: { host: validHost, username: "admin" },
					internalKey: "dsqlToken",
					cacheExpiry: 0,
					cacheKey: "test-internalkey-explicit-expiry",
				}),
			);
		await handler(defaultEvent, newContext());
		token = "token-2";
		await handler(defaultEvent, newContext());
		deepStrictEqual(presented, ["token-1", "token-2"]);
		strictEqual(end.mock.callCount(), 2);
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

	test("It should skip the construction-time prefetch when internalKey is set", async (t) => {
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

	test("dsqlValidateOptions accepts driver options beyond the standard fields", () => {
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

	test("dsqlValidateOptions accepts a PrivateLink cluster hostname", () => {
		dsqlValidateOptions({
			client: () => ({}),
			config: {
				host: "01abc2ldefg3hijklmnopqurstu.dsql-fnh4.us-east-1.on.aws",
			},
		});
	});

	test("dsqlValidateOptions accepts a PrivateLink endpoint domain name as host", () => {
		dsqlValidateOptions({
			client: () => ({}),
			config: {
				host: "vpce-04037adb76c111221-d849uc2p.dsql-fnh4.us-east-1.vpce.amazonaws.com",
			},
		});
	});

	test("dsqlValidateOptions accepts a PrivateLink endpoint IP address as host", () => {
		for (const host of ["10.0.12.34", "fd00:ec2::1a2b"]) {
			dsqlValidateOptions({ client: () => ({}), config: { host } });
		}
	});

	test("dsqlValidateOptions rejects a host that only contains a DSQL hostname", () => {
		for (const host of [
			"cluster.dsql.us-east-1.on.aws.example.com",
			"example.com.cluster.dsql-fnh4.us-east-1.on.aws",
			"vpce-04037adb76c111221-d849uc2p.dsql-fnh4.us-east-1.vpce.amazonaws.com.example.com",
			"10.0.12.34.example.com",
		]) {
			throws(
				() => dsqlValidateOptions({ client: () => ({}), config: { host } }),
				{
					name: "TypeError",
					message:
						"Option 'config.host' must match exactly one schema in oneOf",
				},
			);
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

	test("It should resolve a Promise-valued internalKey token before returning it as password", async (t) => {
		const { client, presented } = buildTokenClient(t);
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
		deepStrictEqual(presented, ["tok", "tok"]);
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

	test("It should honour cacheKeyExpiry -1 over cacheExpiry 0 and keep one client open", async (t) => {
		const { client, end } = buildClient(t);
		const handler = middy(() => {}).use(
			dsqlMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "dsql-keyexpiry-infinite",
				cacheKeyExpiry: { "dsql-keyexpiry-infinite": -1 },
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
			dsqlMiddleware({
				client,
				config: { host: validHost },
				cacheKey: "dsql-keyexpiry-zero",
				cacheKeyExpiry: { "dsql-keyexpiry-zero": 0 },
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
		const { client, presented } = buildTokenClient(t);
		let token = "token-1";
		const handler = middy(() => {})
			.before(async (request) => {
				request.internal.dsqlToken = token;
			})
			.use(
				dsqlMiddleware({
					client,
					config: { host: validHost },
					internalKey: "dsqlToken",
					cacheKey: "dsql-token-refresh",
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
		deepStrictEqual(presented, ["token-1", "token-2", "token-3"]);
	});

	test("It should reconnect with the invocation's token when it starts as the entry expires", async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		const { client, presented } = buildTokenClient(t);
		let token = "token-1";
		const handler = middy(() => {})
			.before((request) => {
				request.internal.dsqlToken = token;
			})
			.use(
				dsqlMiddleware({
					client,
					config: { host: validHost },
					internalKey: "dsqlToken",
					cacheKey: "dsql-token-expiry-race",
					cacheExpiry: 20,
					disablePrefetch: true,
				}),
			);
		await handler(defaultEvent, newContext());
		// A background reconnect has no token, so it can only fail; one that
		// stood in the entry would fail an invocation arriving before it settled.
		token = "token-2";
		t.mock.timers.tick(25);
		await handler(defaultEvent, newContext());
		deepStrictEqual(presented, ["token-1", "token-2"]);
	});

	test("It should keep a refreshed entry when the reconnect it replaced fails", async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		const { client, clients, connects } = buildDeferredClients(t);
		let captured;
		const handler = middy(() => {})
			.use(
				dsqlMiddleware({
					client,
					config: { host: validHost },
					cacheKey: "dsql-stale-reject",
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
				dsqlMiddleware({
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

	test("dsqlValidateOptions accepts cacheMaxSize and rejects values below 1", () => {
		const base = { client: () => ({}), config: { host: validHost } };
		dsqlValidateOptions({ ...base, cacheMaxSize: 10 });
		try {
			dsqlValidateOptions({ ...base, cacheMaxSize: 0 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("cacheMaxSize"));
		}
	});

	test("It should reject a mistyped duration cacheExpiry at construction when internalKey is set", (t) => {
		const client = t.mock.fn(() => ({}));
		for (const opts of [
			{ cacheExpiry: 90000000 },
			{ cacheKeyExpiry: { "@middy/dsql": 90000000 } },
		]) {
			throws(
				() =>
					dsqlMiddleware({
						client,
						config: { host: validHost },
						internalKey: "token",
						...opts,
					}),
				/Invalid cacheExpiry value/,
			);
		}
		// Validation only: with internalKey nothing is prefetched.
		dsqlMiddleware({
			client,
			config: { host: validHost },
			internalKey: "token",
			cacheExpiry: -1,
		});
		strictEqual(client.mock.callCount(), 0);
	});

	test("It should connect from the cached fetch without reading a request", async (t) => {
		const { client, presented } = buildTokenClient(t);
		const handler = middy(() => {})
			.before((request) => {
				request.internal.token = "token-a";
			})
			.use(
				dsqlMiddleware({
					client,
					config: { host: validHost },
					internalKey: "token",
					cacheExpiry: -1,
				}),
			);
		await handler(defaultEvent, newContext());
		deepStrictEqual(presented, ["token-a"]);

		await getCache("@middy/dsql").middlewareFetch({
			internal: { token: "token-b" },
		});
		deepStrictEqual(presented, ["token-a", "token-a"]);
	});

	describe("token password with the bundled adapters", () => {
		const invokeWithRotatingToken = async (t, { client, cacheKey, query }) => {
			const server = await startAuthServer();
			const clients = new Set();
			t.after(async () => {
				for (const cached of clients) await cached.end();
				await server.close();
			});
			let token = "token-1";
			const handler = middy(async (event, context) => {
				clients.add(context.middyContext.dsql);
				await query(context.middyContext.dsql, token);
			})
				.before((request) => {
					request.internal.dsqlToken = token;
				})
				.use(
					dsqlMiddleware({
						client,
						config: {
							host: "127.0.0.1",
							port: server.port,
							username: "admin",
							database: "postgres",
							ssl: false,
						},
						internalKey: "dsqlToken",
						cacheKey,
					}),
				);
			await handler(defaultEvent, newContext());
			token = "token-2";
			await handler(defaultEvent, newContext());
			return { passwords: server.passwords, clients };
		};

		test("It should authenticate each connection of a cached pg.Pool with the latest token", async (t) => {
			const { passwords, clients } = await invokeWithRotatingToken(t, {
				client: clientPgPool,
				cacheKey: "dsql-real-pg-pool",
				query: async (pool) => {
					const connection = await pool.connect();
					await connection.query("SELECT 1");
					// Destroyed rather than returned to the pool, so the next
					// invocation has to open a new physical connection.
					connection.release(true);
				},
			});
			strictEqual(clients.size, 1);
			deepStrictEqual(passwords, ["token-1", "token-2"]);
		});

		test("It should authenticate each connection of a cached postgres.js client with the latest token", async (t) => {
			const { passwords, clients } = await invokeWithRotatingToken(t, {
				client: clientPostgres,
				cacheKey: "dsql-real-postgres",
				query: async (sql) => {
					await sql.unsafe("SELECT 1");
					// Closes the open connections; the next query opens a new one.
					await sql.close();
				},
			});
			strictEqual(clients.size, 1);
			deepStrictEqual(passwords, ["token-1", "token-2"]);
		});

		test("It should authenticate a reconnected pg.Client with the latest token", async (t) => {
			const { passwords, clients } = await invokeWithRotatingToken(t, {
				client: clientPg,
				cacheKey: "dsql-real-pg-client",
				query: async (connection, token) => {
					await connection.query("SELECT 1");
					connection.broken = token === "token-1";
				},
			});
			strictEqual(clients.size, 2);
			deepStrictEqual(passwords, ["token-1", "token-2"]);
		});
	});
});

describe("dsqlValidateOptions connection config", () => {
	const host = "cluster.dsql.us-east-1.on.aws";
	const fn = () => {};
	const withConfig = (config) =>
		dsqlValidateOptions({ client: fn, config: { host, ...config } });
	const rejectsConfig = (config, message) =>
		throws(() => withConfig(config), {
			name: "TypeError",
			message,
			cause: { package: "@middy/dsql" },
		});
	const oneOf = (key) =>
		`Option 'config.${key}' must match exactly one schema in oneOf`;
	const pem = (length) => {
		const head = "-----BEGIN CERTIFICATE-----\n";
		const tail = "\n-----END CERTIFICATE-----\n";
		return `${head}${"A".repeat(length - head.length - tail.length)}${tail}`;
	};

	const accepted = {
		host: [
			host,
			"01abc2ldefg3hijklmnopqurstu.dsql-fnh4.us-gov-west-1.on.aws",
			"vpce-04037adb76c111221-d849uc2p.dsql-fnh4.us-east-1.vpce.amazonaws.com",
			"10.0.12.34",
			"fd00:ec2::1a2b",
		],
		hostname: [host, "10.0.12.34"],
		user: ["iam_role", "x".repeat(63), fn],
		username: ["admin", async () => "admin"],
		database: ["mydb", "x".repeat(63)],
		db: ["postgres"],
		password: ["s3cr3t pässword!", "x".repeat(1024), fn],
		pass: ["s3cr3t", fn],
		port: [1, 5432, 65535],
		connectionString: ["postgres://iam_role@db.example.com:5432/mydb"],
		binary: [true],
		options: ["-c amzn-cluster-id=abc", ""],
		ssl: [
			true,
			false,
			{},
			{ rejectUnauthorized: true, ca: "ca" },
			{
				rejectUnauthorized: true,
				ca: pem(1048576),
				servername: host,
				checkServerIdentity: fn,
			},
			...[true, false].map((rejectUnauthorized) => ({ rejectUnauthorized })),
			"require",
			"allow",
			"prefer",
			"verify-full",
			"disable",
			"no-verify",
			"true",
		],
		sslnegotiation: ["postgres", "direct", null],
		client_encoding: ["UTF8", "EUC_JP"],
		replication: [true, false, "database"],
		application_name: ["svc", "x".repeat(63), ""],
		fallback_application_name: ["svc"],
		statement_timeout: [0, 1000, 2147483647, false],
		lock_timeout: [1000, false],
		idle_in_transaction_session_timeout: [1000, false],
		query_timeout: [0, 1500.5, 2147483647, false],
		connectionTimeoutMillis: [0, 3000, 2147483647],
		keepAlive: [true],
		keepAliveInitialDelayMillis: [10000],
		Promise: [Promise],
		types: [
			{},
			{ getTypeParser: fn },
			{
				bigint: { to: 20, from: [20, "int8"], serialize: fn, parse: fn },
				rect: { to: "rect", from: "rect" },
				point: { from: 600 },
				max: { to: 4294967295 },
			},
		],
		enableChannelBinding: [true],
		scramMaxIterations: [0, 100000, 2147483647],
		stream: [fn],
		pipeline: [true],
		max: [1, 20],
		min: [0, 2],
		poolSize: [10],
		idleTimeoutMillis: [0, 30000, null],
		log: [fn],
		allowExitOnIdle: [true],
		maxUses: [7500],
		maxLifetimeSeconds: [0, 2147483],
		Client: [class {}],
		onConnect: [fn],
		verify: [fn],
		path: ["/tmp/.s.PGSQL.5432"],
		channel_binding: ["disable", "prefer", "require"],
		max_pipeline: [100],
		scheduler: [false],
		idle_timeout: [0, 20, 2147483, false, null],
		queue_timeout: [0],
		cancel_timeout: [5],
		connect_timeout: [30, false, null],
		max_lifetime: [1800, false, null, () => 60],
		backoff: [true, 2, (attempts) => attempts],
		keep_alive: [60, false, null],
		prepare: [false],
		infer: [true],
		fetch_types: [false],
		eager_types: [true],
		onnotice: [false, fn],
		onnotify: [fn],
		onparameter: [fn],
		onclose: [fn],
		debug: [true, fn],
		transform: [
			{ undefined: null },
			{ undefined: "" },
			{ undefined: 0 },
			{ undefined: false },
			{
				json: true,
				column: { from: fn, to: fn },
				value: { from: fn },
				row: { from: fn },
			},
			{ column: fn, value: fn, row: fn },
		],
		connection: [
			{
				application_name: "svc",
				default_transaction_isolation: "read uncommitted",
				default_transaction_read_only: true,
				default_transaction_deferrable: true,
				statement_timeout: 1000,
				lock_timeout: 0,
				idle_in_transaction_session_timeout: 2147483647,
				idle_session_timeout: 1000,
				DateStyle: "ISO, MDY",
				IntervalStyle: "iso_8601",
				TimeZone: "America/New_York",
				"amzn-cluster-id": "abc",
				search_path: "app",
				"my.setting": "",
				work_mem: 4096,
				"my.ratio": -0.5,
				jit: false,
			},
			{ default_transaction_isolation: "read committed" },
			{ default_transaction_isolation: "repeatable read" },
			{ default_transaction_isolation: "serializable" },
			{ IntervalStyle: "postgres" },
			{ IntervalStyle: "postgres_verbose" },
			{ IntervalStyle: "sql_standard" },
		],
		target_session_attrs: [
			"read-write",
			"read-only",
			"primary",
			"standby",
			"prefer-standby",
			null,
		],
		publications: ["alltables", "orders,users"],
		slot: ["my_slot_1", null],
		socket: [fn],
		onread: [false],
		unref_sockets: [true],
		no_prepare: [true],
		timeout: [10],
	};

	test("accepts every connection option the bundled adapters read", () => {
		for (const [key, values] of Object.entries(accepted)) {
			for (const value of values) withConfig({ [key]: value });
		}
	});

	test("rejects a config key no bundled adapter reads", () => {
		rejectsConfig(
			{ connectionTimeout: 1 },
			"Unknown option 'config.connectionTimeout'",
		);
	});

	test("rejects a host longer than a domain name", () => {
		const suffix = ".dsql.us-east-1.on.aws";
		withConfig({ host: `${"a".repeat(253 - suffix.length)}${suffix}` });
		rejectsConfig(
			{ host: `${"a".repeat(254 - suffix.length)}${suffix}` },
			oneOf("host"),
		);
	});

	test("checks hostname, the postgres.js alias of host, as a DSQL host", () => {
		rejectsConfig({ hostname: "db.example.com" }, oneOf("hostname"));
	});

	test("rejects a host list: the token is signed for a single hostname", () => {
		for (const key of ["host", "hostname"]) {
			for (const value of [
				[host],
				[host, "01abc2ldefg3hijklmnopqurstu.dsql-fnh4.us-east-1.on.aws"],
				["10.0.12.34", "10.0.12.35"],
				1,
			]) {
				rejectsConfig({ [key]: value }, oneOf(key));
			}
		}
	});

	test("rejects an over-long or non-text database or role name", () => {
		rejectsConfig(
			{ database: "x".repeat(64) },
			"Option 'config.database' must have length <= 63",
		);
		rejectsConfig(
			{ database: "my\ndb" },
			"Option 'config.database' must match pattern /^[\\p{L}\\p{N}\\p{P}\\p{S} ]+$/u",
		);
		for (const user of ["x".repeat(64), "", "a\tb", 1]) {
			rejectsConfig({ user }, oneOf("user"));
		}
	});

	test("rejects a password that is neither text nor a function", () => {
		for (const password of ["x".repeat(1025), "", "line\nbreak", 1]) {
			rejectsConfig({ password }, oneOf("password"));
		}
	});

	test("rejects a port outside 1 to 65535", () => {
		rejectsConfig({ port: 0 }, "Option 'config.port' must be >= 1");
		rejectsConfig({ port: 65536 }, "Option 'config.port' must be <= 65535");
		rejectsConfig({ port: 5432.5 }, "Option 'config.port' must be integer");
		rejectsConfig({ port: [5432] }, "Option 'config.port' must be integer");
	});

	test("rejects non-printable or over-long driver strings", () => {
		rejectsConfig(
			{ connectionString: "postgres://a b" },
			"Option 'config.connectionString' must match pattern /^[\\x21-\\x7E]+$/u",
		);
		rejectsConfig(
			{ connectionString: "x".repeat(1025) },
			"Option 'config.connectionString' must have length <= 1024",
		);
		rejectsConfig(
			{ options: "-c a=\n" },
			"Option 'config.options' must match pattern /^[\\x20-\\x7E]*$/u",
		);
		rejectsConfig(
			{ options: "x".repeat(1025) },
			"Option 'config.options' must have length <= 1024",
		);
		rejectsConfig(
			{ client_encoding: "UTF 8" },
			"Option 'config.client_encoding' must match pattern /^[\\w-]+$/u",
		);
		rejectsConfig(
			{ application_name: "x".repeat(64) },
			"Option 'config.application_name' must have length <= 63",
		);
		rejectsConfig(
			{ application_name: "sérvice" },
			"Option 'config.application_name' must match pattern /^[\\x20-\\x7E]*$/u",
		);
		rejectsConfig(
			{ path: "tmp/.s.PGSQL.5432" },
			"Option 'config.path' must match pattern /^\\/[\\x21-\\x7E]*$/u",
		);
		rejectsConfig(
			{ publications: "orders';--" },
			"Option 'config.publications' must match pattern /^[\\p{L}\\p{N}_$,]+$/u",
		);
	});

	test("rejects an ssl value that is not a boolean, a mode a driver reads or the TLS options it lists", () => {
		for (const value of [
			"verify-ca",
			"false",
			"",
			{ rejectUnauthorized: "yes" },
			{ ca: pem(1048577) },
			{ ca: "ca\u0000" },
			{ ca: 1 },
			{ servername: "db example.com" },
			{ servername: "x".repeat(254) },
			{ checkServerIdentity: "skip" },
			{ key: "private" },
		]) {
			rejectsConfig({ ssl: value }, oneOf("ssl"));
		}
	});

	test("rejects a value outside the set a driver accepts", () => {
		rejectsConfig({ sslnegotiation: "prefer" }, oneOf("sslnegotiation"));
		rejectsConfig({ replication: "true" }, oneOf("replication"));
		rejectsConfig(
			{ channel_binding: "allow" },
			`Option 'config.channel_binding' must be one of ["disable","prefer","require"]`,
		);
		rejectsConfig(
			{ target_session_attrs: "any" },
			oneOf("target_session_attrs"),
		);
		rejectsConfig({ slot: "My-Slot" }, oneOf("slot"));
		rejectsConfig({ slot: "x".repeat(64) }, oneOf("slot"));
	});

	test("rejects a timeout outside what the server or a Node timer accepts", () => {
		for (const key of [
			"statement_timeout",
			"lock_timeout",
			"idle_in_transaction_session_timeout",
		]) {
			for (const value of [2147483648, -1, 1.5, true]) {
				rejectsConfig({ [key]: value }, oneOf(key));
			}
		}
		for (const value of [2147483648, -1, true]) {
			rejectsConfig({ query_timeout: value }, oneOf("query_timeout"));
		}
		rejectsConfig(
			{ connectionTimeoutMillis: 2147483648 },
			"Option 'config.connectionTimeoutMillis' must be <= 2147483647",
		);
		rejectsConfig(
			{ keepAliveInitialDelayMillis: -1 },
			"Option 'config.keepAliveInitialDelayMillis' must be >= 0",
		);
		rejectsConfig({ idleTimeoutMillis: false }, oneOf("idleTimeoutMillis"));
		rejectsConfig(
			{ maxLifetimeSeconds: 2147484 },
			"Option 'config.maxLifetimeSeconds' must be <= 2147483",
		);
		rejectsConfig(
			{ queue_timeout: -1 },
			"Option 'config.queue_timeout' must be >= 0",
		);
		rejectsConfig(
			{ timeout: 2147484 },
			"Option 'config.timeout' must be <= 2147483",
		);
		for (const key of ["idle_timeout", "connect_timeout", "keep_alive"]) {
			for (const value of [2147484, -1, true]) {
				rejectsConfig({ [key]: value }, oneOf(key));
			}
		}
		for (const value of [2147484, true, "60"]) {
			rejectsConfig({ max_lifetime: value }, oneOf("max_lifetime"));
		}
		for (const value of [-1, "2"]) {
			rejectsConfig({ backoff: value }, oneOf("backoff"));
		}
	});

	test("rejects a pool size or count below its minimum", () => {
		rejectsConfig({ max: 0 }, "Option 'config.max' must be >= 1");
		rejectsConfig({ min: -1 }, "Option 'config.min' must be >= 0");
		rejectsConfig({ poolSize: 0 }, "Option 'config.poolSize' must be >= 1");
		rejectsConfig({ maxUses: 0 }, "Option 'config.maxUses' must be >= 1");
		rejectsConfig(
			{ max_pipeline: 0 },
			"Option 'config.max_pipeline' must be >= 1",
		);
		rejectsConfig(
			{ scramMaxIterations: -1 },
			"Option 'config.scramMaxIterations' must be >= 0",
		);
		rejectsConfig(
			{ scramMaxIterations: 2147483648 },
			"Option 'config.scramMaxIterations' must be <= 2147483647",
		);
		rejectsConfig({ max: 1.5 }, "Option 'config.max' must be integer");
	});

	test("rejects a non-function where a driver calls one", () => {
		for (const key of [
			"Promise",
			"stream",
			"log",
			"Client",
			"onConnect",
			"verify",
			"onnotify",
			"onparameter",
			"onclose",
			"socket",
		]) {
			rejectsConfig(
				{ [key]: {} },
				`Option 'config.${key}' must be instanceof Function`,
			);
		}
		rejectsConfig({ onnotice: true }, oneOf("onnotice"));
		rejectsConfig({ debug: "yes" }, oneOf("debug"));
	});

	test("rejects a non-boolean flag", () => {
		for (const key of [
			"binary",
			"keepAlive",
			"enableChannelBinding",
			"pipeline",
			"allowExitOnIdle",
			"scheduler",
			"prepare",
			"infer",
			"fetch_types",
			"eager_types",
			"onread",
			"unref_sockets",
			"no_prepare",
		]) {
			rejectsConfig({ [key]: "yes" }, `Option 'config.${key}' must be boolean`);
		}
	});

	test("rejects types that are neither a pg type parser nor postgres.js types", () => {
		for (const types of [
			{ getTypeParser: fn, setTypeParser: fn },
			{ getTypeParser: "parse" },
			{ bigint: { to: -1 } },
			{ bigint: { to: 4294967296 } },
			{ bigint: { to: 1.5 } },
			{ bigint: { to: "in\nt8" } },
			{ bigint: { from: [20, 20] } },
			{ bigint: { from: [true] } },
			{ bigint: { from: Array.from({ length: 1025 }, (_, i) => i) } },
			{ bigint: { serialize: "x" } },
			{ bigint: { parse: "x" } },
			{ bigint: { oid: 20 } },
			{ "big int": {} },
			Object.fromEntries(Array.from({ length: 1025 }, (_, i) => [`t${i}`, {}])),
		]) {
			rejectsConfig({ types }, oneOf("types"));
		}
	});

	test("rejects a transform it does not list", () => {
		rejectsConfig(
			{ transform: { columns: fn } },
			"Unknown option 'config.transform.columns'",
		);
		rejectsConfig(
			{ transform: { json: "yes" } },
			"Option 'config.transform.json' must be boolean",
		);
		for (const value of [{}, [], "x".repeat(1025), "\u0000", 2 ** 53]) {
			rejectsConfig(
				{ transform: { undefined: value } },
				oneOf("transform.undefined"),
			);
		}
		for (const [key, value] of [
			["column", { from: fn, into: fn }],
			["column", { to: "x" }],
			["column", { from: "x" }],
			["value", { to: fn }],
			["value", { from: "x" }],
			["row", { to: fn }],
			["row", "x"],
		]) {
			rejectsConfig({ transform: { [key]: value } }, oneOf(`transform.${key}`));
		}
	});

	test("rejects connection parameters that are not scalars or the typed ones", () => {
		for (const value of [null, {}, ["app"]]) {
			rejectsConfig(
				{ connection: { search_path: value } },
				"Option 'config.connection.search_path' must be string or number or boolean",
			);
		}
		rejectsConfig(
			{ connection: { work_mem: 2 ** 53 } },
			"Option 'config.connection.work_mem' must be <= 9007199254740991",
		);
		rejectsConfig(
			{ connection: { work_mem: -(2 ** 53) } },
			"Option 'config.connection.work_mem' must be >= -9007199254740991",
		);
		rejectsConfig(
			{ connection: { search_path: "a\nb" } },
			"Option 'config.connection.search_path' must match pattern /^[\\x20-\\x7E]*$/u",
		);
		rejectsConfig(
			{ connection: { search_path: "x".repeat(1025) } },
			"Option 'config.connection.search_path' must have length <= 1024",
		);
		rejectsConfig(
			{ connection: { "search path": "app" } },
			"Invalid property name 'search path' in option 'config.connection': Option 'config.connection.search path' must match pattern /^[A-Za-z_][\\w.-]*$/u",
		);
		rejectsConfig(
			{ connection: { ["x".repeat(1025)]: "app" } },
			`Invalid property name '${"x".repeat(1025)}' in option 'config.connection': Option 'config.connection.${"x".repeat(1025)}' must have length <= 1024`,
		);
		rejectsConfig(
			{
				connection: Object.fromEntries(
					Array.from({ length: 1025 }, (_, i) => [`p${i}`, ""]),
				),
			},
			"Option 'config.connection' must have <= 1024 properties",
		);
		rejectsConfig(
			{ connection: { default_transaction_isolation: "chaos" } },
			`Option 'config.connection.default_transaction_isolation' must be one of ["read uncommitted","read committed","repeatable read","serializable"]`,
		);
		rejectsConfig(
			{ connection: { IntervalStyle: "iso" } },
			`Option 'config.connection.IntervalStyle' must be one of ["postgres","postgres_verbose","sql_standard","iso_8601"]`,
		);
		rejectsConfig(
			{ connection: { default_transaction_read_only: "on" } },
			"Option 'config.connection.default_transaction_read_only' must be boolean",
		);
		rejectsConfig(
			{ connection: { statement_timeout: 2147483648 } },
			"Option 'config.connection.statement_timeout' must be <= 2147483647",
		);
		rejectsConfig(
			{ connection: { idle_session_timeout: -1 } },
			"Option 'config.connection.idle_session_timeout' must be >= 0",
		);
		rejectsConfig(
			{ connection: { application_name: "x".repeat(64) } },
			"Option 'config.connection.application_name' must have length <= 63",
		);
		rejectsConfig(
			{ connection: { TimeZone: "UTC\n" } },
			"Option 'config.connection.TimeZone' must match pattern /^[\\x20-\\x7E]*$/u",
		);
	});
});

describe("dsqlValidateOptions keys", () => {
	const base = {
		client: () => {},
		config: { host: "cluster.dsql.us-east-1.on.aws" },
	};
	const rejectsOption = (options, message) =>
		throws(() => dsqlValidateOptions({ ...base, ...options }), {
			name: "TypeError",
			message,
			cause: { package: "@middy/dsql" },
		});

	test("accepts a context key, internal key and cache options", () => {
		dsqlValidateOptions({
			...base,
			contextKey: "dsql-reader",
			internalKey: "@middy/dsql-signer.token",
			disablePrefetch: true,
			cacheKey: "@middy/dsql",
			cacheKeyExpiry: { "@middy/dsql": 60_000 },
			cacheExpiry: 0,
			cacheMaxSize: 128,
		});
	});

	test("rejects a context or internal key that is blank or over-long", () => {
		for (const key of ["contextKey", "internalKey"]) {
			rejectsOption(
				{ [key]: "dsql reader" },
				`Option '${key}' must match pattern /^[\\x21-\\x7E]+$/u`,
			);
			rejectsOption(
				{ [key]: "" },
				`Option '${key}' must match pattern /^[\\x21-\\x7E]+$/u`,
			);
			rejectsOption(
				{ [key]: "x".repeat(1025) },
				`Option '${key}' must have length <= 1024`,
			);
		}
	});

	test("rejects a client that is not a function", () => {
		rejectsOption(
			{ client: {} },
			"Option 'client' must be instanceof Function",
		);
	});
});
