import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, mock, test } from "node:test";

const host = "db.example.com";

const calls = [];
const sql = { end: async () => {} };
const postgres = (config) => {
	calls.push(config);
	return sql;
};
mock.module("postgres", { defaultExport: postgres });
const { default: clientPostgres } = await import("./clientPostgres.js");

describe("@middy/rds/clientPostgres", () => {
	test.afterEach(() => {
		calls.length = 0;
	});

	test("clientPostgres is the postgres.js factory", () => {
		strictEqual(clientPostgres, postgres);
	});

	test("clientPostgres passes the config through and returns the sql client", () => {
		// postgres.js reads `username` natively, so no mapping is applied.
		const config = { host, username: "iam_role", port: 5432 };
		const client = clientPostgres(config);

		strictEqual(client, sql);
		deepStrictEqual(calls, [config]);
	});
});
