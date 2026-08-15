import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";

test("clientPgPool returns a pg.Pool built from config", async (t) => {
	let constructedWith;

	t.mock.module("pg", {
		defaultExport: {
			Pool: class {
				constructor(config) {
					constructedWith = config;
					this.mark = "pg-pool";
				}
			},
		},
	});

	const { default: clientPgPool } = await import("./clientPgPool.js");
	const config = { host: "cluster.dsql.us-east-1.on.aws", ssl: true };
	const result = clientPgPool(config);

	// Arrow body must run: construct a Pool with config and return it.
	strictEqual(constructedWith, config);
	ok(result);
	strictEqual(result.mark, "pg-pool");
});
