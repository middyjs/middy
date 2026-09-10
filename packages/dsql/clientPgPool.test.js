import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, mock, test } from "node:test";

const host = "cluster.dsql.us-east-1.on.aws";

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

describe("@middy/dsql/clientPgPool", () => {
	test.afterEach(() => {
		instances.length = 0;
	});

	test("clientPgPool returns a pg.Pool built from config", () => {
		const config = { host, ssl: true };
		const result = clientPgPool(config);

		// Arrow body must run: construct a Pool with config and return it.
		strictEqual(instances.length, 1);
		strictEqual(result, instances[0]);
		deepStrictEqual(result.config, config);
	});

	test("clientPgPool maps `username` to pg's `user`", () => {
		clientPgPool({ host, username: "admin", ssl: true });
		deepStrictEqual(instances[0].config, { user: "admin", host, ssl: true });
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
			"@middy/dsql",
			"Connection terminated unexpectedly",
		]);
	});
});
