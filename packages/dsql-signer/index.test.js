import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { after, before, test } from "node:test";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
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

	try {
		await handler(defaultEvent, defaultContext);
	} catch (e) {
		strictEqual(getDbConnectAuthToken.mock.callCount(), 1);
		strictEqual(e.message, "Failed to resolve internal values");
		deepStrictEqual(e.cause.data, [
			new Error("X-Amz-Security-Token Missing", {
				cause: {
					package: "@middy/dsql-signer",
					method: "getDbConnectAuthToken",
				},
			}),
		]);
	}
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
