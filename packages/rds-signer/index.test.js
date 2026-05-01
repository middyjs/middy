import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { after, before, test } from "node:test";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
import rdsSigner, { rdsSignerValidateOptions } from "./index.js";

before(() => {
	process.env.PGHOST = "hostname";
	process.env.PGPORT = "5432";
	process.env.PGUSER = "username";
});

after(() => {
	delete process.env.PGHOST;
	delete process.env.PGPORT;
	delete process.env.PGUSER;
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
	const getAuthToken = t.mock.fn(
		async () => "https://rds.amazonaws.com?X-Amz-Security-Token=token",
	);
	class AwsClient {
		getAuthToken = getAuthToken;
	}
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(
			values.token,
			"https://rds.amazonaws.com?X-Amz-Security-Token=token",
		);
	};

	handler
		.use(
			rdsSigner({
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
});

test("It should set tokens to internal storage (token)", async (t) => {
	const getAuthToken = t.mock.fn(
		async () => "https://rds.amazonaws.com?X-Amz-Security-Token=token2",
		async () => "https://rds.amazonaws.com?X-Amz-Security-Token=token1",
		{ times: 1 },
	);
	class AwsClient {
		getAuthToken = getAuthToken;
	}

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(
			values.token1,
			"https://rds.amazonaws.com?X-Amz-Security-Token=token1",
		);
		strictEqual(
			values.token2,
			"https://rds.amazonaws.com?X-Amz-Security-Token=token2",
		);
	};

	handler
		.use(
			rdsSigner({
				AwsClient,
				cacheExpiry: 0,
				fetchData: {
					token1: { region: "us-east-1", hostname: "hostname-reader" },
					token2: { region: "us-east-1", hostname: "hostname-writer" },
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should set Signer token to internal storage without prefetch", async (t) => {
	const getAuthToken = t.mock.fn(
		async () => "https://rds.amazonaws.com?X-Amz-Security-Token=token",
	);
	class AwsClient {
		getAuthToken = getAuthToken;
	}
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(
			values.token,
			"https://rds.amazonaws.com?X-Amz-Security-Token=token",
		);
	};

	handler
		.use(
			rdsSigner({
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
});

test("It should set Signer token to context", async (t) => {
	const getAuthToken = t.mock.fn(
		async () => "https://rds.amazonaws.com?X-Amz-Security-Token=token",
	);
	class AwsClient {
		getAuthToken = getAuthToken;
	}
	const handler = middy(() => {});

	const middleware = async (request) => {
		strictEqual(
			request.context.token,
			"https://rds.amazonaws.com?X-Amz-Security-Token=token",
		);
	};

	handler
		.use(
			rdsSigner({
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
	const getAuthToken = t.mock.fn(
		async () => "https://rds.amazonaws.com?X-Amz-Security-Token=token",
	);
	class AwsClient {
		getAuthToken = getAuthToken;
	}
	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(
			values.token,
			"https://rds.amazonaws.com?X-Amz-Security-Token=token",
		);
	};

	handler
		.use(
			rdsSigner({
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

	strictEqual(getAuthToken.mock.callCount(), 1);
});

test("It should call aws-sdk if cache enabled but cached param has expired", async (t) => {
	const getAuthToken = t.mock.fn(
		async () => "https://rds.amazonaws.com?X-Amz-Security-Token=token",
	);
	class AwsClient {
		getAuthToken = getAuthToken;
	}

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(
			values.token,
			"https://rds.amazonaws.com?X-Amz-Security-Token=token",
		);
	};

	handler
		.use(
			rdsSigner({
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

	strictEqual(getAuthToken.mock.callCount(), 2);
});

test("It should catch if an error is returned from fetch", async (t) => {
	const getAuthToken = t.mock.fn(async () => {
		throw new Error("timeout");
	});
	class AwsClient {
		getAuthToken = getAuthToken;
	}
	const handler = middy(() => {}).use(
		rdsSigner({
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
		strictEqual(getAuthToken.mock.callCount(), 1);
		strictEqual(e.message, "Failed to resolve internal values");
		deepStrictEqual(e.cause.data, [new Error("timeout")]);
	}
});

test("It should catch if an invalid response is returned from fetch", async (t) => {
	const getAuthToken = t.mock.fn(async () => "https://rds.amazonaws.com");
	class AwsClient {
		getAuthToken = getAuthToken;
	}
	const handler = middy(() => {}).use(
		rdsSigner({
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
		strictEqual(getAuthToken.mock.callCount(), 1);
		strictEqual(e.message, "Failed to resolve internal values");
		deepStrictEqual(e.cause.data, [
			new Error("X-Amz-Security-Token Missing", {
				cause: { package: "@middy/rds-signer", method: "getAuthToken" },
			}),
		]);
	}
});

test("It should skip fetching already cached values when fetching multiple keys", async (t) => {
	let callCount = 0;
	const getAuthToken = t.mock.fn(async () => {
		callCount++;
		// First call for token1 succeeds
		if (callCount === 1) {
			return "https://rds.amazonaws.com?X-Amz-Security-Token=token1";
		}
		// First call for token2 fails
		if (callCount === 2) {
			throw new Error("timeout");
		}
		// Second call only fetches token2 (token1 is cached)
		if (callCount === 3) {
			return "https://rds.amazonaws.com?X-Amz-Security-Token=token2";
		}
	});
	class AwsClient {
		getAuthToken = getAuthToken;
	}

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(
			values.token1,
			"https://rds.amazonaws.com?X-Amz-Security-Token=token1",
		);
		strictEqual(
			values.token2,
			"https://rds.amazonaws.com?X-Amz-Security-Token=token2",
		);
	};

	const handler = middy(() => {});

	handler
		.use(
			rdsSigner({
				AwsClient,
				cacheExpiry: 1000,
				fetchData: {
					token1: { region: "us-east-1", hostname: "hostname-reader" },
					token2: { region: "us-east-1", hostname: "hostname-writer" },
				},
			}),
		)
		.before(middleware);

	// First call - token1 succeeds, token2 fails
	try {
		await handler(defaultEvent, defaultContext);
	} catch (_e) {
		// Expected to fail
	}

	// Second call - only token2 is fetched (token1 is already cached)
	await handler(defaultEvent, defaultContext);

	// Should have called getAuthToken 3 times total (token1 once, token2 twice)
	strictEqual(getAuthToken.mock.callCount(), 3);
});

test("It should export rdsSignerParam helper for TypeScript type inference", async (t) => {
	const { rdsSignerParam } = await import("./index.js");
	const paramName = "test-param";
	const result = rdsSignerParam(paramName);
	strictEqual(result, paramName);
});

test("It should use DBHOST/DBPORT/DBUSER env var defaults as fallback", async (t) => {
	const savedPGHOST = process.env.PGHOST;
	const savedPGPORT = process.env.PGPORT;
	const savedPGUSER = process.env.PGUSER;
	delete process.env.PGHOST;
	delete process.env.PGPORT;
	delete process.env.PGUSER;
	process.env.DBHOST = "db.example.com";
	process.env.DBPORT = "5434";
	process.env.DBUSER = "dbuser";
	t.after(() => {
		delete process.env.DBHOST;
		delete process.env.DBPORT;
		delete process.env.DBUSER;
		process.env.PGHOST = savedPGHOST;
		process.env.PGPORT = savedPGPORT;
		process.env.PGUSER = savedPGUSER;
	});

	let receivedConfig;
	class AwsClient {
		constructor(config) {
			receivedConfig = config;
		}
		getAuthToken = t.mock.fn(
			async () => "https://rds.amazonaws.com?X-Amz-Security-Token=token",
		);
	}
	const handler = middy(() => {}).use(
		rdsSigner({
			AwsClient,
			cacheExpiry: 0,
			fetchData: { token: {} },
			disablePrefetch: true,
		}),
	);

	await handler(defaultEvent, defaultContext);
	strictEqual(receivedConfig.hostname, "db.example.com");
	strictEqual(receivedConfig.port, 5434);
	strictEqual(receivedConfig.username, "dbuser");
});

test("It should use default port 5432 when no PGPORT/DBPORT env var is set", async (t) => {
	const savedPGPORT = process.env.PGPORT;
	delete process.env.PGPORT;
	t.after(() => {
		process.env.PGPORT = savedPGPORT;
	});

	let receivedConfig;
	class AwsClient {
		constructor(config) {
			receivedConfig = config;
		}
		getAuthToken = t.mock.fn(
			async () => "https://rds.amazonaws.com?X-Amz-Security-Token=token",
		);
	}
	const handler = middy(() => {}).use(
		rdsSigner({
			AwsClient,
			cacheExpiry: 0,
			fetchData: { token: {} },
			disablePrefetch: true,
		}),
	);

	await handler(defaultEvent, defaultContext);
	strictEqual(receivedConfig.port, 5432);
});

test("It should prefer explicit fetchData values over env var defaults", async (t) => {
	let receivedConfig;
	class AwsClient {
		constructor(config) {
			receivedConfig = config;
		}
		getAuthToken = t.mock.fn(
			async () => "https://rds.amazonaws.com?X-Amz-Security-Token=token",
		);
	}
	const handler = middy(() => {}).use(
		rdsSigner({
			AwsClient,
			cacheExpiry: 0,
			fetchData: {
				token: {
					hostname: "explicit.example.com",
					port: 9999,
					username: "explicit",
				},
			},
			disablePrefetch: true,
		}),
	);

	await handler(defaultEvent, defaultContext);
	strictEqual(receivedConfig.hostname, "explicit.example.com");
	strictEqual(receivedConfig.port, 9999);
	strictEqual(receivedConfig.username, "explicit");
});

test("rdsSignerValidateOptions accepts valid options and rejects typos", () => {
	rdsSignerValidateOptions({ cacheKey: "x", cacheExpiry: 0 });
	rdsSignerValidateOptions({});
	try {
		rdsSignerValidateOptions({ cachExpiry: 60 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/rds-signer");
	}
});

test("rdsSignerValidateOptions rejects wrong type", () => {
	try {
		rdsSignerValidateOptions({ fetchData: 42 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("fetchData"));
	}
});

test("rdsSignerValidateOptions accepts valid fetchData entry", () => {
	rdsSignerValidateOptions({
		fetchData: {
			token: {
				region: "us-east-1",
				hostname: "db.example.com",
				port: 5432,
				username: "user",
			},
		},
	});
});

test("rdsSignerValidateOptions accepts fetchData entry relying on env var defaults", () => {
	rdsSignerValidateOptions({ fetchData: { token: {} } });
	rdsSignerValidateOptions({
		fetchData: { token: { hostname: "db.example.com" } },
	});
});

test("rdsSignerValidateOptions rejects fetchData entry with non-integer port", () => {
	try {
		rdsSignerValidateOptions({
			fetchData: {
				token: {
					hostname: "db.example.com",
					port: "5432",
					username: "user",
				},
			},
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});
