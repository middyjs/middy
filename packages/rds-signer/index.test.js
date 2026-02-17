import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
import rdsSigner from "./index.js";

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
					token: {
						region: "us-east-1",
						hostname: "hostname",
						username: "username",
						port: 5432,
					},
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
					token1: {
						region: "us-east-1",
						hostname: "hostname-reader",
						username: "username",
						port: 5432,
					},
					token2: {
						region: "us-east-1",
						hostname: "hostname-writer",
						username: "username",
						port: 5432,
					},
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
					token: {
						region: "us-east-1",
						hostname: "hostname",
						username: "username",
						port: 5432,
					},
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
					token: {
						region: "us-east-1",
						hostname: "hostname",
						username: "username",
						port: 5432,
					},
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
					token: {
						region: "us-east-1",
						hostname: "hostname",
						username: "username",
						port: 5432,
					},
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
					token: {
						region: "us-east-1",
						hostname: "hostname",
						username: "username",
						port: 5432,
					},
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
				token: {
					region: "us-east-1",
					hostname: "hostname",
					username: "username",
					port: 5432,
				},
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
				token: {
					region: "us-east-1",
					hostname: "hostname",
					username: "username",
					port: 5432,
				},
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
				cause: { package: "@middy/rds-signer" },
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
					token1: {
						region: "us-east-1",
						hostname: "hostname-reader",
						username: "username",
						port: 5432,
					},
					token2: {
						region: "us-east-1",
						hostname: "hostname-writer",
						username: "username",
						port: 5432,
					},
				},
			}),
		)
		.before(middleware);

	// First call - token1 succeeds, token2 fails
	try {
		await handler(defaultEvent, defaultContext);
	} catch (e) {
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
