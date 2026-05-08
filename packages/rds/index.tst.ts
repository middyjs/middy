import type middy from "@middy/core";
import { expect, test } from "tstyche";
import rdsMiddleware from "./index.js";

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
	).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
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
		}),
	).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("rejects calls missing required options", () => {
	expect(rdsMiddleware).type.not.toBeCallableWith();
	expect(rdsMiddleware).type.not.toBeCallableWith({
		config: { host: validHost },
	});
	expect(rdsMiddleware).type.not.toBeCallableWith({ client });
});
