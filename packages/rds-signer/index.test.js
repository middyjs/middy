import { deepEqual, equal } from "node:assert/strict";
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
		equal(values.token, "https://rds.amazonaws.com?X-Amz-Security-Token=token");
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
		equal(
			values.token1,
			"https://rds.amazonaws.com?X-Amz-Security-Token=token1",
		);
		equal(
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
		equal(values.token, "https://rds.amazonaws.com?X-Amz-Security-Token=token");
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
		equal(
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
		equal(values.token, "https://rds.amazonaws.com?X-Amz-Security-Token=token");
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

	equal(getAuthToken.mock.callCount(), 1);
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
		equal(values.token, "https://rds.amazonaws.com?X-Amz-Security-Token=token");
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

	equal(getAuthToken.mock.callCount(), 2);
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
		equal(getAuthToken.mock.callCount(), 1);
		equal(e.message, "Failed to resolve internal values");
		deepEqual(e.cause.data, [new Error("timeout")]);
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
		equal(getAuthToken.mock.callCount(), 1);
		equal(e.message, "Failed to resolve internal values");
		deepEqual(e.cause.data, [
			new Error("X-Amz-Security-Token Missing", {
				cause: { package: "@middy/rds-signer" },
			}),
		]);
	}
});
