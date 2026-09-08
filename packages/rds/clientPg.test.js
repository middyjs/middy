import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mock, test } from "node:test";

const host = "db.example.com";

const instances = [];
class Client extends EventEmitter {
	constructor(config) {
		super();
		this.config = config;
		this.connect = mock.fn(async () => {});
		instances.push(this);
	}
}
mock.module("pg", { defaultExport: { Client } });
const { default: clientPg } = await import("./clientPg.js");

test.afterEach(() => {
	instances.length = 0;
});

test("clientPg constructs a pg.Client with the config, connects, and returns it", async () => {
	const config = { host, port: 5432 };
	const client = await clientPg(config);

	strictEqual(instances.length, 1);
	strictEqual(client, instances[0]);
	deepStrictEqual(client.config, config);
	strictEqual(client.connect.mock.callCount(), 1);
});

test("clientPg maps `username` to pg's `user`", async () => {
	// The docs and the signer's fetchData use `username`; pg only reads `user`.
	await clientPg({ host, username: "iam_role", port: 5432 });
	deepStrictEqual(instances[0].config, { user: "iam_role", host, port: 5432 });
});

test("clientPg logs an unexpected `error` event and flags the client broken", async (t) => {
	const errorMock = t.mock.method(console, "error", () => {});
	const client = await clientPg({ host });
	strictEqual(client.broken, undefined);
	// Without a listener a dropped connection is an uncaught exception that
	// crashes the process; the middleware reconnects a flagged client instead.
	client.emit("error", new Error("Connection terminated unexpectedly"));
	strictEqual(client.broken, true);
	strictEqual(errorMock.mock.callCount(), 1);
	deepStrictEqual(errorMock.mock.calls[0].arguments, [
		"%s: client error: %s",
		"@middy/rds",
		"Connection terminated unexpectedly",
	]);
});
