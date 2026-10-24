import middy from "@middy/core";
import type { Client } from "pg";
import { expect, test } from "tstyche";
import clientPg from "./clientPg.js";
import type { Context } from "./index.js";
import dsqlMiddleware, * as indexModule from "./index.js";

const client = (_config: { host: string }) => ({
	query: async (_sql: string) => ({ rows: [] as unknown[] }),
	end: async () => {},
});

const validHost = "cluster.dsql.us-east-1.on.aws";

test("returns a MiddlewareObj when given client + config", () => {
	expect(
		dsqlMiddleware({
			client,
			config: { host: validHost },
		}),
	).type.toBe<
		middy.MiddlewareObj<
			unknown,
			unknown,
			Error,
			Context<ReturnType<typeof client>>
		>
	>();
});

test("accepts the full option surface", () => {
	expect(
		dsqlMiddleware({
			client,
			config: {
				host: validHost,
				username: "admin",
				database: "postgres",
				port: 5432,
			},
			contextKey: "db",
			internalKey: "dsqlToken",
			disablePrefetch: true,
			cacheKey: "k",
			cacheKeyExpiry: { k: 60_000 },
			cacheExpiry: -1,
			cacheMaxSize: 100,
		}),
	).type.toBe<
		middy.MiddlewareObj<
			unknown,
			unknown,
			Error,
			Context<ReturnType<typeof client>, "db">
		>
	>();
});

test("rejects calls missing required options", () => {
	expect(dsqlMiddleware).type.not.toBeCallableWith();
	expect(dsqlMiddleware).type.not.toBeCallableWith({
		config: { host: validHost },
	});
	expect(dsqlMiddleware).type.not.toBeCallableWith({ client });
});

test("dsqlValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.DsqlOptions;
	expect(
		indexModule.dsqlValidateOptions(options),
	).type.toBe<indexModule.DsqlOptions>();
});

test("the client is typed on middyContext under the default key", () => {
	middy()
		.use(dsqlMiddleware({ client, config: { host: validHost } }))
		.before((request) => {
			expect(request.context.middyContext.dsql).type.toBe<
				ReturnType<typeof client>
			>();
		});
});

test("contextKey and the adapter's client type narrow middyContext", () => {
	middy()
		.use(
			dsqlMiddleware({
				client: clientPg,
				config: { host: validHost },
				contextKey: "db",
			}),
		)
		.before((request) => {
			expect(request.context.middyContext.db).type.toBe<Client>();
		});
});

test("rejects misspelled option", () => {
	expect(dsqlMiddleware).type.not.toBeCallableWith({
		client,
		config: { host: validHost },
		cacheExpiery: 1000,
	});
});
