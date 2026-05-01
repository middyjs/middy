import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import { clearCache } from "../util/index.js";
import dsqlMiddleware, { dsqlValidateOptions } from "./index.js";

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
	const clientFn = client ?? t.mock.fn(() => ({ end: endFn, mark: "client" }));
	return { client: clientFn, end: endFn };
};

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
		captured = request.context.dsql;
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
		region: "us-east-1",
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
	strictEqual(client.mock.calls[0].arguments[0], config);
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
		captured = { dsql: request.context.dsql, db: request.context.db };
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
		strictEqual(e.message, "client option missing");
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
			region: "us-east-1",
			port: 5432,
			tokenDurationSecs: 900,
		},
		contextKey: "dsql",
		disablePrefetch: false,
		cacheKey: "k",
		cacheKeyExpiry: { k: 60_000 },
		cacheExpiry: -1,
	});
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
