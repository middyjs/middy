import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, mock, test } from "node:test";

const host = "cluster.dsql.us-east-1.on.aws";

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

describe("@middy/dsql/clientPg", () => {
	test.afterEach(() => {
		instances.length = 0;
	});

	test("clientPg connects and returns a pg.Client built from config", async () => {
		const config = { host, ssl: true };
		const result = await clientPg(config);

		// Body must run: construct with config, connect, and return the client.
		strictEqual(instances.length, 1);
		strictEqual(result, instances[0]);
		deepStrictEqual(result.config, config);
		strictEqual(result.connect.mock.callCount(), 1);
	});

	test("clientPg maps `username` to pg's `user`", async () => {
		// The docs and the signer's fetchData use `username`; pg only reads `user`.
		await clientPg({ host, username: "admin", ssl: true });
		deepStrictEqual(instances[0].config, { user: "admin", host, ssl: true });
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
			"@middy/dsql",
			"Connection terminated unexpectedly",
		]);
	});
});
