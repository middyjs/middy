import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mock, test } from "node:test";

const host = "db.example.com";

const instances = [];
class Pool extends EventEmitter {
	constructor(config) {
		super();
		this.config = config;
		instances.push(this);
	}
}
mock.module("pg", { defaultExport: { Pool } });
const { default: clientPgPool } = await import("./clientPgPool.js");

test.afterEach(() => {
	instances.length = 0;
});

test("clientPgPool constructs and returns a pg.Pool with the config", () => {
	const config = { host, port: 5432 };
	const pool = clientPgPool(config);

	strictEqual(instances.length, 1);
	strictEqual(pool, instances[0]);
	deepStrictEqual(pool.config, config);
});

test("clientPgPool maps `username` to pg's `user`", () => {
	clientPgPool({ host, username: "iam_role", port: 5432 });
	deepStrictEqual(instances[0].config, { user: "iam_role", host, port: 5432 });
});

test("clientPgPool logs an idle-client `error` event and keeps the pool usable", (t) => {
	const errorMock = t.mock.method(console, "error", () => {});
	const pool = clientPgPool({ host });
	// pg.Pool discards the failed idle client itself, so the pool is not
	// flagged broken; the listener only has to stop the process from crashing.
	pool.emit("error", new Error("Connection terminated unexpectedly"));
	strictEqual(pool.broken, undefined);
	strictEqual(errorMock.mock.callCount(), 1);
	deepStrictEqual(errorMock.mock.calls[0].arguments, [
		"%s: pool error: %s",
		"@middy/rds",
		"Connection terminated unexpectedly",
	]);
});
