import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { mock, test } from "node:test";

test("clientPg constructs a pg.Client with the config, connects, and returns it", async (t) => {
	const connect = t.mock.fn(async () => {});
	const instances = [];
	class Client {
		constructor(config) {
			this.config = config;
			this.connect = connect;
			instances.push(this);
		}
	}
	t.mock.module("pg", {
		defaultExport: { Client },
	});
	const { default: clientPg } = await import(`./clientPg.js?${Math.random()}`);

	const config = { host: "db.example.com", port: 5432 };
	const client = await clientPg(config);

	strictEqual(instances.length, 1);
	strictEqual(client, instances[0]);
	deepStrictEqual(client.config, config);
	strictEqual(connect.mock.callCount(), 1);
	ok(client, "expected a defined client to be returned");
	mock.reset();
});
