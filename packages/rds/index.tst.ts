import middy from "@middy/core";
import type { Client } from "pg";
import { expect, test } from "tstyche";
import clientPg from "./clientPg.js";
import type { Context } from "./index.js";
import rdsMiddleware, * as indexModule from "./index.js";

const client = (_config: { host: string }) => ({
	query: async (_sql: string) => ({ rows: [] as unknown[] }),
	end: async () => {},
});

const validHost = "db.cluster-abc.us-east-1.rds.amazonaws.com";

test("returns a MiddlewareObj when given client + config", () => {
	expect(
		rdsMiddleware({
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
		rdsMiddleware({
			client,
			config: {
				host: validHost,
				username: "admin",
				database: "postgres",
				port: 5432,
			},
			contextKey: "db",
			internalKey: "rdsToken",
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
	expect(rdsMiddleware).type.not.toBeCallableWith();
	expect(rdsMiddleware).type.not.toBeCallableWith({
		config: { host: validHost },
	});
	expect(rdsMiddleware).type.not.toBeCallableWith({ client });
});

test("rdsValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.RdsOptions;
	expect(
		indexModule.rdsValidateOptions(options),
	).type.toBe<indexModule.RdsOptions>();
});

test("the client is typed on middyContext under the default key", () => {
	middy()
		.use(rdsMiddleware({ client, config: { host: validHost } }))
		.before((request) => {
			expect(request.context.middyContext.rds).type.toBe<
				ReturnType<typeof client>
			>();
		});
});

test("contextKey and the adapter's client type narrow middyContext", () => {
	middy()
		.use(
			rdsMiddleware({
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
	expect(rdsMiddleware).type.not.toBeCallableWith({
		client,
		config: { host: validHost },
		cacheExpiery: 1000,
	});
});
