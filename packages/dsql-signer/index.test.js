import {
	deepStrictEqual,
	ok,
	rejects,
	strictEqual,
	throws,
} from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import middy from "@middy/core";
import { clearCache, getInternal } from "@middy/util";
import dsqlSigner, { dsqlSignerValidateOptions } from "./index.js";

describe("@middy/dsql-signer", () => {
	before(() => {
		process.env.PGHOST = "cluster.dsql.us-east-1.on.aws";
	});

	after(() => {
		delete process.env.PGHOST;
	});

	test.afterEach((t) => {
		t.mock.reset();
		clearCache();
	});

	const defaultEvent = {};
	const defaultContext = {
		getRemainingTimeInMillis: () => 1000,
	};

	test("It should not mutate the caller's fetchData", () => {
		class AwsClient {
			getDbConnectAuthToken = async () => "token";
		}
		const entry = { region: "us-east-1" };
		const fetchData = { token: entry };
		dsqlSigner({ AwsClient, fetchData, disablePrefetch: true });
		strictEqual(fetchData.token, entry);
		deepStrictEqual(entry, { region: "us-east-1" });
	});

	test("It should set token to internal storage (token)", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () =>
				"cluster.dsql.us-east-1.on.aws/?Action=DbConnect&X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}
		const handler = middy(() => {});

		const middleware = async (request) => {
			const values = await getInternal(true, request);
			strictEqual(
				values.token,
				"cluster.dsql.us-east-1.on.aws/?Action=DbConnect&X-Amz-Security-Token=token",
			);
		};

		handler
			.use(
				dsqlSigner({
					AwsClient,
					cacheExpiry: 0,
					fetchData: {
						token: { region: "us-east-1" },
					},
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
	});

	test("It should call admin token method when username is 'admin'", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=non-admin-token",
		);
		const getDbConnectAdminAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=admin-token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
			getDbConnectAdminAuthToken = getDbConnectAdminAuthToken;
		}
		const handler = middy(() => {});

		const middleware = async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.token, "X-Amz-Security-Token=admin-token");
		};

		handler
			.use(
				dsqlSigner({
					AwsClient,
					cacheExpiry: 0,
					fetchData: {
						token: { region: "us-east-1", username: "admin" },
					},
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAdminAuthToken.mock.callCount(), 1);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 0);
	});

	test("It should call non-admin token method when username is a custom role", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=role-token",
		);
		const getDbConnectAdminAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=admin-token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
			getDbConnectAdminAuthToken = getDbConnectAdminAuthToken;
		}
		const handler = middy(() => {});

		const middleware = async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.token, "X-Amz-Security-Token=role-token");
		};

		handler
			.use(
				dsqlSigner({
					AwsClient,
					cacheExpiry: 0,
					fetchData: {
						token: { region: "us-east-1", username: "app_reader" },
					},
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
		strictEqual(getDbConnectAdminAuthToken.mock.callCount(), 0);
	});

	test("It should not pass `username` to the signer constructor", async (t) => {
		let receivedConfig;
		const getDbConnectAdminAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=admin-token",
		);
		class AwsClient {
			constructor(config) {
				receivedConfig = config;
			}
			getDbConnectAdminAuthToken = getDbConnectAdminAuthToken;
		}
		const handler = middy(() => {});

		handler.use(
			dsqlSigner({
				AwsClient,
				cacheExpiry: 0,
				fetchData: {
					token: { username: "admin" },
				},
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		deepStrictEqual(receivedConfig, {
			hostname: "cluster.dsql.us-east-1.on.aws",
		});
	});

	test("It should set tokens to internal storage (multiple keys)", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token2",
			async () => "X-Amz-Security-Token=token1",
			{ times: 1 },
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}

		const handler = middy(() => {});

		const middleware = async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.token1, "X-Amz-Security-Token=token1");
			strictEqual(values.token2, "X-Amz-Security-Token=token2");
		};

		handler
			.use(
				dsqlSigner({
					AwsClient,
					cacheExpiry: 0,
					fetchData: {
						token1: {
							region: "us-east-1",
							hostname: "reader.dsql.us-east-1.on.aws",
						},
						token2: {
							region: "us-east-1",
							hostname: "writer.dsql.us-east-1.on.aws",
						},
					},
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
	});

	test("It should set DSQL token to context", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}
		const handler = middy(() => {});

		const middleware = async (request) => {
			strictEqual(
				request.context.middyContext["dsql-signer"].token,
				"X-Amz-Security-Token=token",
			);
		};

		handler
			.use(
				dsqlSigner({
					AwsClient,
					cacheExpiry: 0,
					fetchData: {
						token: { region: "us-east-1" },
					},
					setToContext: true,
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
	});

	test("It should not call aws-sdk again if parameter is cached", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}
		const handler = middy(() => {});

		const middleware = async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.token, "X-Amz-Security-Token=token");
		};

		handler
			.use(
				dsqlSigner({
					AwsClient,
					cacheExpiry: -1,
					fetchData: {
						token: { region: "us-east-1" },
					},
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);

		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
	});

	test("It should call aws-sdk if cache enabled but cached param has expired", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}

		const handler = middy(() => {});

		const middleware = async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.token, "X-Amz-Security-Token=token");
		};

		handler
			.use(
				dsqlSigner({
					AwsClient,
					cacheExpiry: 0,
					fetchData: {
						token: { region: "us-east-1" },
					},
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);

		strictEqual(getDbConnectAuthToken.mock.callCount(), 2);
	});

	test("It should catch if an error is returned from fetch", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(async () => {
			throw new Error("timeout");
		});
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}
		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				cacheExpiry: 0,
				fetchData: {
					token: { region: "us-east-1" },
				},
				setToContext: true,
				disablePrefetch: true,
			}),
		);

		try {
			await handler(defaultEvent, defaultContext);
		} catch (e) {
			strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
			strictEqual(e.message, "Failed to resolve internal values");
			deepStrictEqual(e.errors, [new Error("timeout")]);
		}
	});

	test("It should catch if a token without X-Amz-Security-Token is returned from fetch", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(async () => "no-creds");
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}
		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				cacheExpiry: 0,
				fetchData: {
					token: { region: "us-east-1" },
				},
				setToContext: true,
				disablePrefetch: true,
			}),
		);

		let caught;
		await rejects(async () => {
			try {
				await handler(defaultEvent, defaultContext);
			} catch (e) {
				caught = e;
				throw e;
			}
		}, /Failed to resolve internal values/);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
		strictEqual(caught.message, "Failed to resolve internal values");
		deepStrictEqual(caught.errors, [
			new Error("X-Amz-Security-Token Missing", {
				cause: {
					package: "@middy/dsql-signer",
					data: { method: "getDbConnectAuthToken" },
				},
			}),
		]);
	});

	test("It should skip fetching already cached values when fetching multiple keys", async (t) => {
		let callCount = 0;
		const getDbConnectAuthToken = t.mock.fn(async () => {
			callCount++;
			if (callCount === 1) return "X-Amz-Security-Token=token1";
			if (callCount === 2) throw new Error("timeout");
			if (callCount === 3) return "X-Amz-Security-Token=token2";
		});
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}

		const middleware = async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.token1, "X-Amz-Security-Token=token1");
			strictEqual(values.token2, "X-Amz-Security-Token=token2");
		};

		const handler = middy(() => {});

		handler
			.use(
				dsqlSigner({
					AwsClient,
					cacheExpiry: 1000,
					fetchData: {
						token1: {
							region: "us-east-1",
							hostname: "reader.dsql.us-east-1.on.aws",
						},
						token2: {
							region: "us-east-1",
							hostname: "writer.dsql.us-east-1.on.aws",
						},
					},
				}),
			)
			.before(middleware);

		try {
			await handler(defaultEvent, defaultContext);
		} catch (_e) {}

		await handler(defaultEvent, defaultContext);

		strictEqual(getDbConnectAuthToken.mock.callCount(), 3);
	});

	test("It should not emit unhandledRejection when prefetch token fetch fails at construction", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(async () => {
			throw new Error("timeout");
		});
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}

		const unhandled = [];
		const onUnhandled = (reason) => {
			unhandled.push(reason);
		};
		process.on("unhandledRejection", onUnhandled);
		t.after(() => {
			process.off("unhandledRejection", onUnhandled);
		});

		const handler = middy(() => {})
			.use(
				dsqlSigner({
					AwsClient,
					cacheExpiry: -1,
					fetchData: {
						token: { region: "us-east-1" },
					},
					disablePrefetch: false,
				}),
			)
			.before(async (request) => {
				// A consumer that awaits the internal value surfaces the failure.
				await getInternal(true, request);
			});

		// Allow any microtasks/macrotasks from the prefetch rejection to flush.
		await new Promise((resolve) => setImmediate(resolve));
		deepStrictEqual(unhandled, []);

		// The fetch failure surfaces when a consumer awaits the internal value.
		await rejects(
			() => handler(defaultEvent, defaultContext),
			/Failed to resolve internal values/,
		);

		// Still no unhandledRejection after invocation.
		await new Promise((resolve) => setImmediate(resolve));
		deepStrictEqual(unhandled, []);
	});

	test("It should export dsqlSignerParam helper for TypeScript type inference", async (t) => {
		const { dsqlSignerParam } = await import("./index.js");
		const paramName = "test-param";
		const result = dsqlSignerParam(paramName);
		strictEqual(result, paramName);
	});

	test("It should use DBHOST/DBUSER env var defaults as fallback", async (t) => {
		const savedPGHOST = process.env.PGHOST;
		delete process.env.PGHOST;
		process.env.DBHOST = "cluster.dsql.us-east-1.on.aws";
		process.env.DBUSER = "app_reader";
		t.after(() => {
			delete process.env.DBHOST;
			delete process.env.DBUSER;
			process.env.PGHOST = savedPGHOST;
		});

		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=role-token",
		);
		let receivedConfig;
		class AwsClient {
			constructor(config) {
				receivedConfig = config;
			}
			getDbConnectAuthToken = getDbConnectAuthToken;
		}
		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				cacheExpiry: 0,
				fetchData: { token: {} },
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		strictEqual(receivedConfig.hostname, "cluster.dsql.us-east-1.on.aws");
		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
	});

	test("It should keep awsClientOptions values when no env var or fetchData value replaces them", async (t) => {
		const savedPGHOST = process.env.PGHOST;
		delete process.env.PGHOST;
		t.after(() => {
			process.env.PGHOST = savedPGHOST;
		});

		const getDbConnectAdminAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=admin-token",
		);
		let receivedConfig;
		class AwsClient {
			constructor(config) {
				receivedConfig = config;
			}
			getDbConnectAdminAuthToken = getDbConnectAdminAuthToken;
		}
		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				awsClientOptions: {
					region: "us-east-1",
					hostname: "options.dsql.us-east-1.on.aws",
					username: "admin",
				},
				cacheExpiry: 0,
				fetchData: { token: {} },
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		deepStrictEqual(receivedConfig, {
			region: "us-east-1",
			hostname: "options.dsql.us-east-1.on.aws",
		});
		strictEqual(getDbConnectAdminAuthToken.mock.callCount(), 1);
	});

	test("It should rank fetchData over env vars over awsClientOptions", async (t) => {
		process.env.PGUSER = "admin";
		t.after(() => {
			delete process.env.PGUSER;
		});
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=role-token",
		);
		let receivedConfig;
		class AwsClient {
			constructor(config) {
				receivedConfig = config;
			}
			getDbConnectAuthToken = getDbConnectAuthToken;
		}
		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				awsClientOptions: {
					hostname: "options.dsql.us-east-1.on.aws",
					username: "options_role",
				},
				cacheExpiry: 0,
				fetchData: { token: { username: "app_reader" } },
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		deepStrictEqual(receivedConfig, {
			hostname: "cluster.dsql.us-east-1.on.aws",
		});
		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
	});

	test("It should prefer explicit fetchData values over env var defaults", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=role-token",
		);
		let receivedConfig;
		class AwsClient {
			constructor(config) {
				receivedConfig = config;
			}
			getDbConnectAuthToken = getDbConnectAuthToken;
		}
		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				cacheExpiry: 0,
				fetchData: {
					token: {
						hostname: "explicit.dsql.us-east-1.on.aws",
						username: "app_reader",
					},
				},
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		strictEqual(receivedConfig.hostname, "explicit.dsql.us-east-1.on.aws");
		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
	});

	test("dsqlSignerValidateOptions accepts valid options and rejects typos", () => {
		dsqlSignerValidateOptions({ cacheKey: "x", cacheExpiry: 0 });
		dsqlSignerValidateOptions({});
		try {
			dsqlSignerValidateOptions({ cachExpiry: 60 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/dsql-signer");
		}
	});

	test("dsqlSignerValidateOptions rejects wrong type", () => {
		try {
			dsqlSignerValidateOptions({ fetchData: 42 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("fetchData"));
		}
	});

	test("dsqlSignerValidateOptions accepts valid fetchData entry", () => {
		dsqlSignerValidateOptions({
			fetchData: {
				token: {
					hostname: "cluster.dsql.us-east-1.on.aws",
					username: "admin",
				},
			},
		});
	});

	test("dsqlSignerValidateOptions accepts fetchData entry relying on env var defaults", () => {
		dsqlSignerValidateOptions({ fetchData: { token: {} } });
		dsqlSignerValidateOptions({ fetchData: { token: { username: "admin" } } });
	});

	test("dsqlSignerValidateOptions rejects fetchData entry with non-string username", () => {
		try {
			dsqlSignerValidateOptions({
				fetchData: {
					token: {
						hostname: "cluster.dsql.us-east-1.on.aws",
						username: true,
					},
				},
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
		}
	});

	test("It should throw at creation when hostname is missing and no env var is set", (t) => {
		const savedPGHOST = process.env.PGHOST;
		delete process.env.PGHOST;
		delete process.env.DBHOST;
		t.after(() => {
			process.env.PGHOST = savedPGHOST;
		});

		try {
			dsqlSigner({ fetchData: { token: {} } });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("hostname is required"));
			strictEqual(e.cause?.package, "@middy/dsql-signer");
		}
	});

	test("dsqlSignerValidateOptions rejects fetchData entry with non-DSQL hostname", () => {
		try {
			dsqlSignerValidateOptions({
				fetchData: {
					token: { hostname: "db.example.com" },
				},
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/dsql-signer");
		}
	});

	test("dsqlSignerValidateOptions accepts a PrivateLink cluster hostname", () => {
		dsqlSignerValidateOptions({
			fetchData: {
				token: {
					hostname: "01abc2ldefg3hijklmnopqurstu.dsql-fnh4.us-east-1.on.aws",
				},
			},
		});
	});

	test("dsqlSignerValidateOptions rejects a PrivateLink endpoint domain name as hostname", () => {
		try {
			dsqlSignerValidateOptions({
				fetchData: {
					token: {
						hostname:
							"vpce-04037adb76c111221-d849uc2p.dsql-fnh4.us-east-1.vpce.amazonaws.com",
					},
				},
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("fetchData.token.hostname"));
		}
	});

	test("dsqlSignerValidateOptions accepts a Function AwsClient", () => {
		dsqlSignerValidateOptions({ AwsClient: function MyClient() {} });
	});

	test("dsqlSignerValidateOptions accepts an object awsClientOptions", () => {
		dsqlSignerValidateOptions({ awsClientOptions: { region: "us-east-1" } });
	});

	test("dsqlSignerValidateOptions accepts a boolean disablePrefetch", () => {
		dsqlSignerValidateOptions({ disablePrefetch: true });
	});

	test("dsqlSignerValidateOptions accepts a boolean setToContext", () => {
		dsqlSignerValidateOptions({ setToContext: true });
	});

	test("dsqlSignerValidateOptions accepts fetchData entry with extra properties", () => {
		dsqlSignerValidateOptions({
			fetchData: {
				token: {
					hostname: "cluster.dsql.us-east-1.on.aws",
					region: "us-east-1",
					expiresIn: 900,
				},
			},
		});
	});

	test("dsqlSignerValidateOptions accepts cacheKeyExpiry with numeric entries >= -1", () => {
		dsqlSignerValidateOptions({ cacheKeyExpiry: {} });
		dsqlSignerValidateOptions({ cacheKeyExpiry: { "@middy/dsql-signer": -1 } });
		dsqlSignerValidateOptions({ cacheKeyExpiry: { "@middy/dsql-signer": 0 } });
	});

	test("dsqlSignerValidateOptions rejects cacheKeyExpiry with a non-number entry", () => {
		try {
			dsqlSignerValidateOptions({
				cacheKeyExpiry: { "@middy/dsql-signer": "soon" },
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/dsql-signer");
		}
	});

	test("dsqlSignerValidateOptions rejects cacheKeyExpiry with an entry below -1", () => {
		try {
			dsqlSignerValidateOptions({
				cacheKeyExpiry: { "@middy/dsql-signer": -2 },
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/dsql-signer");
		}
	});

	test("It should not require fetchData (defaults to empty object)", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}
		const handler = middy(() => {}).use(
			dsqlSigner({ AwsClient, cacheExpiry: 0, disablePrefetch: true }),
		);

		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 0);
	});

	test("It should prefetch at creation time by default", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}

		dsqlSigner({
			AwsClient,
			cacheExpiry: -1,
			fetchData: {
				token: { region: "us-east-1" },
			},
		});

		// Prefetch runs synchronously at factory time when disablePrefetch defaults
		// to false; the token fetch is issued before any handler invocation.
		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
	});

	test("It should not set token to context by default", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}
		const handler = middy(() => {});

		const middleware = async (request) => {
			strictEqual(request.context.middyContext["dsql-signer"], undefined);
		};

		handler
			.use(
				dsqlSigner({
					AwsClient,
					cacheExpiry: 0,
					fetchData: {
						token: { region: "us-east-1" },
					},
					disablePrefetch: true,
				}),
			)
			.before(middleware);

		await handler(defaultEvent, { getRemainingTimeInMillis: () => 1000 });
	});

	test("It should never expire the cache with the default cacheExpiry", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}

		// Default cacheExpiry is -1 (infinite). Prefetch runs at factory time and
		// no refresh timer is scheduled, so after a real delay there must still be
		// exactly one fetch. A finite default would schedule a refresh and re-fetch.
		dsqlSigner({
			AwsClient,
			fetchData: {
				token: { region: "us-east-1" },
			},
		});

		await new Promise((resolve) => setTimeout(resolve, 25));
		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
	});

	test("It should fall back to PGUSER for the default username", async (t) => {
		const savedPGUSER = process.env.PGUSER;
		process.env.PGUSER = "admin";
		delete process.env.DBUSER;
		t.after(() => {
			if (savedPGUSER === undefined) delete process.env.PGUSER;
			else process.env.PGUSER = savedPGUSER;
		});

		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		const getDbConnectAdminAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=admin-token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
			getDbConnectAdminAuthToken = getDbConnectAdminAuthToken;
		}
		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				cacheExpiry: 0,
				fetchData: { token: {} },
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAdminAuthToken.mock.callCount(), 1);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 0);
	});

	test("It should refresh the token 14 min after issue with the default cacheExpiry", async (t) => {
		// Only Date is mocked: the cache refresh timer stays real (and unref'd) so
		// the refetch below is driven by the invocation, not by a fired timer.
		t.mock.timers.enable({ apis: ["Date"] });
		t.mock.timers.setTime(1_700_000_000_000);
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}

		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				cacheKey: "dsql-signer-token-lifetime",
				fetchData: {
					token: { region: "us-east-1" },
				},
			}),
		);

		await handler(defaultEvent, defaultContext);
		// 13 min after issue the 15 min IAM token is still valid: cache hit.
		t.mock.timers.tick(13 * 60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
		// 15 min after issue the token has expired, so a new one is signed even
		// though cacheExpiry is -1.
		t.mock.timers.tick(2 * 60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 2);
	});

	test("It should refresh one minute before a custom expiresIn", async (t) => {
		t.mock.timers.enable({ apis: ["Date"] });
		t.mock.timers.setTime(1_700_000_000_000);
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}

		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				awsClientOptions: { expiresIn: 300 },
				cacheKey: "dsql-signer-custom-expiresIn",
				fetchData: {
					token: { region: "us-east-1" },
				},
			}),
		);

		await handler(defaultEvent, defaultContext);
		t.mock.timers.tick(3 * 60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
		// A 5 min token is refreshed after 4 min, not after the default 14 min.
		t.mock.timers.tick(2 * 60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 2);
	});

	test("It should never cache the token when cacheExpiry is 0", async (t) => {
		t.mock.timers.enable({ apis: ["Date"] });
		t.mock.timers.setTime(1_700_000_000_000);
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}

		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				cacheKey: "dsql-signer-no-cache",
				cacheExpiry: 0,
				fetchData: {
					token: { region: "us-east-1" },
				},
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);
		t.mock.timers.tick(60 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 3);
	});

	test("dsqlSignerValidateOptions validates contextKey as a string", () => {
		// Pins the rule itself: an empty `{}` rule would accept the number below,
		// and a blank `type` would reject the valid string above.
		dsqlSignerValidateOptions({ contextKey: "custom" });
		try {
			dsqlSignerValidateOptions({ contextKey: 123 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("contextKey"));
		}
	});

	test("It should sign a fresh token per invocation when expiresIn is shorter than the refresh margin", async (t) => {
		t.mock.timers.enable({ apis: ["Date"] });
		t.mock.timers.setTime(1_700_000_000_000);
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}

		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				awsClientOptions: { expiresIn: 30 },
				cacheKey: "dsql-signer-short-expiresIn",
				fetchData: {
					token: { region: "us-east-1" },
				},
				disablePrefetch: true,
			}),
		);

		// A 30 s token minus the 60 s refresh margin leaves no lifetime in which a
		// cached token is guaranteed valid, so it is not cached: every invocation
		// signs a new token, even with the default cacheExpiry of -1.
		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 2);
		t.mock.timers.tick(10 * 1000);
		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 3);
	});

	test("It should sign a fresh token per invocation when expiresIn equals the refresh margin", async (t) => {
		t.mock.timers.enable({ apis: ["Date"] });
		t.mock.timers.setTime(1_700_000_000_000);
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}

		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				awsClientOptions: { expiresIn: 60 },
				cacheKey: "dsql-signer-margin-expiresIn",
				fetchData: {
					token: { region: "us-east-1" },
				},
				disablePrefetch: true,
			}),
		);

		// 60 s minus the 60 s margin is a zero lifetime: the token is not cached.
		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);
		strictEqual(getDbConnectAuthToken.mock.callCount(), 2);
	});

	test("It should honour a per-cacheKey expiry override from cacheKeyExpiry", async (t) => {
		const getDbConnectAuthToken = t.mock.fn(
			async () => "X-Amz-Security-Token=token",
		);
		class AwsClient {
			getDbConnectAuthToken = getDbConnectAuthToken;
		}
		const handler = middy(() => {}).use(
			dsqlSigner({
				AwsClient,
				cacheKey: "dsql-signer-keyexpiry-cache",
				// Infinite default, but the per-key override disables caching for this
				// cacheKey, forcing a fresh token on every invocation.
				cacheExpiry: -1,
				cacheKeyExpiry: { "dsql-signer-keyexpiry-cache": 0 },
				fetchData: {
					token: { region: "us-east-1" },
				},
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);

		strictEqual(getDbConnectAuthToken.mock.callCount(), 2);
	});

	test("dsqlSignerValidateOptions accepts cacheMaxSize and rejects values below 1", () => {
		dsqlSignerValidateOptions({ cacheMaxSize: 10 });
		try {
			dsqlSignerValidateOptions({ cacheMaxSize: 0 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("cacheMaxSize"));
		}
	});
});

describe("dsqlSignerValidateOptions signer options", () => {
	const fn = () => {};
	const signer = {
		region: "us-east-1",
		hostname: "cluster.dsql.us-east-1.on.aws",
		username: "admin",
	};
	const rejectsOption = (options, message) =>
		throws(() => dsqlSignerValidateOptions(options), {
			name: "TypeError",
			message,
			cause: { package: "@middy/dsql-signer" },
		});
	// Each entry is checked both as a fetchData entry and as awsClientOptions,
	// which is merged into every entry before the DsqlSigner is built.
	const bothWays = (entry, check) => {
		check({ fetchData: { token: entry } }, "fetchData.token");
		check({ awsClientOptions: entry }, "awsClientOptions");
	};

	test("accepts every key of the DsqlSigner configuration and username", () => {
		for (const entry of [
			{},
			signer,
			{
				hostname: "01abc2ldefg3hijklmnopqurstu.dsql-fnh4.us-gov-west-1.on.aws",
				username: "x".repeat(63),
			},
			{ expiresIn: 1 },
			{ expiresIn: 900 },
			{ expiresIn: 604800 },
			{ region: fn, profile: "prod", sha256: class {} },
			{ credentials: fn },
			{
				credentials: {
					accessKeyId: "AKIAIOSFODNN7EXAMPLE",
					secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
				},
			},
		]) {
			bothWays(entry, (options) => dsqlSignerValidateOptions(options));
		}
	});

	test("rejects a key the DsqlSigner does not read", () => {
		bothWays({ ...signer, port: 5432 }, (options, path) =>
			rejectsOption(options, `Unknown option '${path}.port'`),
		);
	});

	test("rejects an expiresIn outside one second to one week", () => {
		bothWays({ expiresIn: 0 }, (options, path) =>
			rejectsOption(options, `Option '${path}.expiresIn' must be >= 1`),
		);
		bothWays({ expiresIn: 604801 }, (options, path) =>
			rejectsOption(options, `Option '${path}.expiresIn' must be <= 604800`),
		);
		bothWays({ expiresIn: 1.5 }, (options, path) =>
			rejectsOption(options, `Option '${path}.expiresIn' must be integer`),
		);
	});

	test("rejects a hostname that is not a DSQL cluster endpoint", () => {
		const suffix = ".dsql.us-east-1.on.aws";
		bothWays(
			{ hostname: `${"a".repeat(253 - suffix.length)}${suffix}` },
			(options) => dsqlSignerValidateOptions(options),
		);
		const pattern =
			"/^[a-z0-9]+\\.dsql(-[a-z0-9]+)?\\.[a-z]{2}-[a-z]+(-[a-z]+)?-\\d+\\.on\\.aws$/u";
		for (const [hostname, rule] of [
			[`${"a".repeat(254 - suffix.length)}${suffix}`, "have length <= 253"],
			["cluster-id.dsql.us-east-1.on.aws", `match pattern ${pattern}`],
			["cluster.dsql.us-east-1.on.aws.example.com", `match pattern ${pattern}`],
		]) {
			bothWays({ hostname }, (options, path) =>
				rejectsOption(options, `Option '${path}.hostname' must ${rule}`),
			);
		}
	});

	test("rejects a username that is not a role name", () => {
		bothWays({ username: "x".repeat(64) }, (options, path) =>
			rejectsOption(
				options,
				`Option '${path}.username' must have length <= 63`,
			),
		);
		bothWays({ username: "app\treader" }, (options, path) =>
			rejectsOption(
				options,
				`Option '${path}.username' must match pattern /^[\\p{L}\\p{N}\\p{P}\\p{S} ]+$/u`,
			),
		);
	});

	test("rejects credentials, region, profile or sha256 the SDK cannot use", () => {
		for (const [entry, key] of [
			[{ credentials: "AKIA" }, "credentials"],
			[{ region: "us east 1" }, "region"],
		]) {
			bothWays(entry, (options, path) =>
				rejectsOption(
					options,
					`Option '${path}.${key}' must match exactly one schema in oneOf`,
				),
			);
		}
		bothWays({ profile: "my profile" }, (options, path) =>
			rejectsOption(
				options,
				`Option '${path}.profile' must match pattern /^[\\x21-\\x7E]+$/u`,
			),
		);
		bothWays({ sha256: "sha256" }, (options, path) =>
			rejectsOption(
				options,
				`Option '${path}.sha256' must be instanceof Function`,
			),
		);
	});

	test("rejects a fetchData key that is blank, or too many of them", () => {
		dsqlSignerValidateOptions({ fetchData: { "@middy/x": {} } });
		for (const key of ["dsql token", ""]) {
			rejectsOption(
				{ fetchData: { [key]: {} } },
				`Invalid property name '${key}' in option 'fetchData': Option 'fetchData.${key}' must match pattern /^[\\x21-\\x7E]+$/u`,
			);
		}
		rejectsOption(
			{ fetchData: { ["x".repeat(1025)]: {} } },
			`Invalid property name '${"x".repeat(1025)}' in option 'fetchData': Option 'fetchData.${"x".repeat(1025)}' must have length <= 1024`,
		);
		rejectsOption(
			{
				fetchData: Object.fromEntries(
					Array.from({ length: 1025 }, (_, i) => [`token${i}`, {}]),
				),
			},
			"Option 'fetchData' must have <= 1024 properties",
		);
	});

	test("accepts the context options and cache options", () => {
		dsqlSignerValidateOptions({
			AwsClient: class {},
			setToContext: true,
			contextKey: "dsql-signer",
			disablePrefetch: true,
			cacheKey: "@middy/dsql-signer",
			cacheKeyExpiry: { "@middy/dsql-signer": -1 },
			cacheExpiry: 840_000,
			cacheMaxSize: 128,
		});
	});

	test("rejects a non-function AwsClient, or a context key that is blank or over-long", () => {
		rejectsOption(
			{ AwsClient: {} },
			"Option 'AwsClient' must be instanceof Function",
		);
		rejectsOption(
			{ setToContext: "yes" },
			"Option 'setToContext' must be boolean",
		);
		dsqlSignerValidateOptions({ contextKey: "@middy/x" });
		for (const contextKey of ["dsql signer", ""]) {
			rejectsOption(
				{ contextKey },
				"Option 'contextKey' must match pattern /^[\\x21-\\x7E]+$/u",
			);
		}
		rejectsOption(
			{ contextKey: "x".repeat(1025) },
			"Option 'contextKey' must have length <= 1024",
		);
	});
});
