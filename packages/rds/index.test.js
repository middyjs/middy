import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import { clearCache } from "../util/index.js";
import rdsMiddleware, { rdsValidateOptions } from "./index.js";

test.afterEach(() => {
	clearCache();
});

const defaultEvent = {};
const newContext = () => ({
	getRemainingTimeInMillis: () => 1000,
});

const validHost = "db.cluster-abc.us-east-1.rds.amazonaws.com";

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
		strictEqual(e.message, "client option missing");
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
