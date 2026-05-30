import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { mock, test } from "node:test";

test("clientPgPool constructs and returns a pg.Pool with the config", async (t) => {
	const instances = [];
	class Pool {
		constructor(config) {
			this.config = config;
			instances.push(this);
		}
	}
	t.mock.module("pg", {
		defaultExport: { Pool },
	});
	const { default: clientPgPool } = await import(
		`./clientPgPool.js?${Math.random()}`
	);

	const config = { host: "db.example.com", port: 5432 };
	const pool = clientPgPool(config);

	strictEqual(instances.length, 1);
	strictEqual(pool, instances[0]);
	ok(pool instanceof Pool, "expected a Pool instance to be returned");
	deepStrictEqual(pool.config, config);
	mock.reset();
});
