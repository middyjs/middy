import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";

test("clientPg connects and returns a pg.Client built from config", async (t) => {
	let constructedWith;
	let connectCalled = 0;

	t.mock.module("pg", {
		defaultExport: {
			Client: class {
				constructor(config) {
					constructedWith = config;
					this.mark = "pg-client";
				}
				async connect() {
					connectCalled += 1;
				}
			},
		},
	});

	const { default: clientPg } = await import("./clientPg.js");
	const config = { host: "cluster.dsql.us-east-1.on.aws", ssl: true };
	const result = await clientPg(config);

	// Body must run: construct with config, connect, and return the client.
	strictEqual(constructedWith, config);
	strictEqual(connectCalled, 1);
	ok(result);
	strictEqual(result.mark, "pg-client");
});
