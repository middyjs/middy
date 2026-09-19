import { deepEqual, equal, ok } from "node:assert/strict";
import { afterEach, describe, mock, test } from "node:test";
import { handleError } from "./handleError.js";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const makeEvent = (headers = {}) => ({
	url: new URL("https://middy.js.org/docs/intro?q=secret"),
	route: { id: "/docs/[...slug]" },
	request: new Request("https://middy.js.org/docs/intro", { headers }),
	platform: { env: { API_TOKEN: "do-not-log" }, cf: { colo: "YYZ" } },
	cookies: { get: () => "session-cookie" },
});

const captureLog = async (input) => {
	const spy = mock.method(console, "error", () => {});
	await handleError(input);
	equal(spy.mock.callCount(), 1);
	const line = spy.mock.calls[0].arguments[0];
	ok(line.endsWith("\n"));
	return { line, entry: JSON.parse(line) };
};

describe("handleError", () => {
	afterEach(() => {
		mock.restoreAll();
	});

	test("logs only the request identity and the error details", async () => {
		const error = new Error("boom");
		const { line, entry } = await captureLog({
			error,
			event: makeEvent({ "cf-ray": "8a1b2c3d4e5f6789-YYZ" }),
			status: 500,
			message: "Internal Error",
		});
		deepEqual(Object.keys(entry).sort(), [
			"log_level",
			"message",
			"path",
			"request_id",
			"route_id",
			"stack",
			"status_code",
		]);
		equal(entry.log_level, "ERROR");
		equal(entry.message, "boom");
		equal(entry.stack, error.stack);
		equal(entry.status_code, 500);
		equal(entry.request_id, "8a1b2c3d4e5f6789-YYZ");
		equal(entry.path, "/docs/intro");
		equal(entry.route_id, "/docs/[...slug]");
		ok(!line.includes("do-not-log"));
		ok(!line.includes("session-cookie"));
		ok(!line.includes("q=secret"));
	});

	test("falls back to the nil UUID without a cf-ray header", async () => {
		const { entry } = await captureLog({
			error: new Error("boom"),
			event: makeEvent(),
			status: 404,
			message: "Not Found",
		});
		equal(entry.request_id, NIL_UUID);
		equal(entry.status_code, 404);
	});

	test("uses Kit's message when a non-Error value was thrown", async () => {
		const { entry } = await captureLog({
			error: "string thrown",
			event: makeEvent(),
			status: 500,
			message: "Internal Error",
		});
		equal(entry.message, "Internal Error");
		equal("stack" in entry, false);
	});

	test("tolerates a missing error value", async () => {
		const { entry } = await captureLog({
			error: undefined,
			event: makeEvent(),
			status: 500,
			message: "Internal Error",
		});
		equal(entry.message, "Internal Error");
	});
});
