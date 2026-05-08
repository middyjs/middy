import type middy from "@middy/core";
import { expect, test } from "tstyche";
import dsqlMiddleware from "./index.js";

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
	).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("accepts the full option surface", () => {
	expect(
		dsqlMiddleware({
			client,
			config: {
				host: validHost,
				username: "admin",
				database: "postgres",
				region: "us-east-1",
				port: 5432,
				tokenDurationSecs: 900,
			},
			contextKey: "db",
			disablePrefetch: true,
			cacheKey: "k",
			cacheKeyExpiry: { k: 60_000 },
			cacheExpiry: -1,
		}),
	).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("rejects calls missing required options", () => {
	expect(dsqlMiddleware).type.not.toBeCallableWith();
	expect(dsqlMiddleware).type.not.toBeCallableWith({
		config: { host: validHost },
	});
	expect(dsqlMiddleware).type.not.toBeCallableWith({ client });
});
