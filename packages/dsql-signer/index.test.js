import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
import { after, before, test } from "node:test";
import { clearCache, getInternal } from "@middy/util";
import middy from "../core/index.js";
import dsqlSigner, { dsqlSignerValidateOptions } from "./index.js";

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
		strictEqual(request.context.token, "X-Amz-Security-Token=token");
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
		deepStrictEqual(e.cause.data, [new Error("timeout")]);
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
	deepStrictEqual(caught.cause.data, [
		new Error("X-Amz-Security-Token Missing", {
			cause: {
				package: "@middy/dsql-signer",
				method: "getDbConnectAuthToken",
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
		strictEqual(request.context.token, undefined);
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
