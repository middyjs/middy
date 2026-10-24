import type postgres from "postgres";
import { expect, test } from "tstyche";
import clientPostgres from "./clientPostgres.js";

test("clientPostgres resolves to a postgres.js sql client", () => {
	expect(clientPostgres({ host: "db.example.com" })).type.toBe<
		ReturnType<typeof postgres> | Promise<ReturnType<typeof postgres>>
	>();
});

test("clientPostgres requires a config argument", () => {
	expect(clientPostgres).type.not.toBeCallableWith();
});
