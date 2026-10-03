import type { Client } from "pg";
import { expect, test } from "tstyche";
import clientPg from "./clientPg.js";

test("clientPg resolves to a pg.Client", () => {
	expect(clientPg({ host: "db.example.com" })).type.toBe<
		Client | Promise<Client>
	>();
});

test("clientPg requires a config argument", () => {
	expect(clientPg).type.not.toBeCallableWith();
});
