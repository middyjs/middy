import type { Pool } from "pg";
import { expect, test } from "tstyche";
import clientPgPool from "./clientPgPool.js";

test("clientPgPool resolves to a pg.Pool", () => {
	expect(clientPgPool({ host: "db.example.com" })).type.toBe<
		Pool | Promise<Pool>
	>();
});

test("clientPgPool requires a config argument", () => {
	expect(clientPgPool).type.not.toBeCallableWith();
});
