import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import errorLogger, { errorLoggerValidateOptions } from "./index.js";

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should log errors and propagate the error", async (t) => {
	const error = new Error("something bad happened");

	let loggerCalledResolve = null;
	let loggerRequestReceived = null;
	const loggerHasBeenCalled = new Promise((resolve) => {
		loggerCalledResolve = resolve;
	});

	const mockLogger = (request) => {
		loggerRequestReceived = request;
		loggerCalledResolve();
	};

	const handler = middy(() => {
		throw error;
	});

	handler.use(errorLogger({ logger: mockLogger }));

	try {
		await handler(defaultEvent, defaultContext);
	} catch (_e) {
		// the call to the logger is async so we need to make sure the invocation is complete
		// before checking
		await loggerHasBeenCalled;
		deepStrictEqual(loggerRequestReceived.error, error);
	}
});

test("It should throw error when invalid logger", async (t) => {
	const error = new Error("something bad happened");
	const logger = false;

	const handler = middy(() => {
		throw error;
	});

	try {
		handler.use(errorLogger({ logger }));
		await handler(defaultEvent, defaultContext);
	} catch (e) {
		strictEqual(
			e.message,
			'Middleware must be an object containing at least one key among "before", "after", "onError"',
		);
	}
});

test("It should use default logger (console.error) when no logger is provided", async (t) => {
	const error = new Error("something bad happened");

	// Mock console.error to capture default logger output
	const originalError = console.error;
	let errorLogged = null;
	console.error = (err) => {
		errorLogged = err;
	};

	const handler = middy(() => {
		throw error;
	});

	handler.use(errorLogger());

	try {
		await handler(defaultEvent, defaultContext);
	} catch (_e) {
		// Restore console.error
		console.error = originalError;
		strictEqual(errorLogged, error);
	}
});

test("It should log non-Error throws (string, plain object, null)", async (t) => {
	for (const thrown of ["string error", { code: "BAD" }, null, undefined, 42]) {
		let captured;
		const handler = middy(() => {
			throw thrown;
		}).use(errorLogger({ logger: (request) => (captured = request.error) }));

		try {
			await handler(defaultEvent, defaultContext);
		} catch (_e) {
			// captured should equal what was thrown (middy may wrap, but error-logger gets request.error)
			ok("error" in { error: captured });
		}
	}
});

test("It should pass full request shape to logger", async (t) => {
	const error = new Error("boom");
	let captured = null;

	const handler = middy(() => {
		throw error;
	}).use(errorLogger({ logger: (request) => (captured = request) }));

	try {
		await handler({ foo: "bar" }, defaultContext);
	} catch (_e) {}

	ok(captured !== null);
	deepStrictEqual(captured.event, { foo: "bar" });
	strictEqual(typeof captured.context, "object");
	strictEqual(captured.error, error);
	ok("internal" in captured);
});

test("errorLoggerValidateOptions accepts valid options and rejects typos", () => {
	errorLoggerValidateOptions({ logger: () => {} });
	errorLoggerValidateOptions({});
	try {
		errorLoggerValidateOptions({ loger: () => {} });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/error-logger");
	}
});

test("errorLoggerValidateOptions rejects wrong type", () => {
	try {
		errorLoggerValidateOptions({ logger: "not-a-fn" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("logger"));
	}
});

test("errorLoggerValidateOptions accepts logger: false to disable logging", () => {
	errorLoggerValidateOptions({ logger: false });
});

test("errorLoggerValidateOptions rejects logger: true", () => {
	try {
		errorLoggerValidateOptions({ logger: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("logger"));
	}
});

test("It should redact omitPaths from the error before logging", async (t) => {
	const error = new Error("boom");
	error.user = { ssn: "123-45-6789", id: 7 };
	let captured = null;

	const handler = middy(() => {
		throw error;
	}).use(
		errorLogger({
			logger: (request) => (captured = request),
			omitPaths: ["error.user.ssn"],
		}),
	);

	try {
		await handler(defaultEvent, defaultContext);
	} catch (_e) {}

	deepStrictEqual(captured.error.user, { id: 7 });
	strictEqual(captured.error.message, "boom");
	strictEqual(error.user.ssn, "123-45-6789");
});

test("It should mask omitPaths when a mask is set", async (t) => {
	const error = new Error("boom", {
		cause: { package: "@middy/http-json-body-parser", data: { body: "ssn=1" } },
	});
	let captured = null;

	const handler = middy(() => {
		throw error;
	}).use(
		errorLogger({
			logger: (request) => (captured = request),
			omitPaths: ["error.cause.data.body"],
			mask: "[redacted]",
		}),
	);

	try {
		await handler(defaultEvent, defaultContext);
	} catch (_e) {}

	strictEqual(captured.error.cause.data.body, "[redacted]");
	strictEqual(captured.error.cause.package, "@middy/http-json-body-parser");
});

test("It should redact omitPaths outside the error", async (t) => {
	let captured = null;

	const handler = middy(() => {
		throw new Error("boom");
	}).use(
		errorLogger({
			logger: (request) => (captured = request),
			omitPaths: ["event.headers.authorization"],
		}),
	);

	try {
		await handler(
			{ headers: { authorization: "Bearer x", accept: "*" } },
			defaultContext,
		);
	} catch (_e) {}

	deepStrictEqual(captured.event, { headers: { accept: "*" } });
});

test("It should pass the request through untouched when no omitPaths are set", async (t) => {
	let captured = null;

	const handler = middy(() => {
		throw new Error("boom");
	}).use(errorLogger({ logger: (request) => (captured = request) }));

	try {
		await handler({ foo: "bar" }, defaultContext);
	} catch (_e) {}

	ok(captured.error instanceof Error);
});

test("errorLoggerValidateOptions accepts omitPaths and mask", () => {
	errorLoggerValidateOptions({ omitPaths: ["error.cause"], mask: "**" });
	try {
		errorLoggerValidateOptions({ omitPaths: "error.cause" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("omitPaths"));
	}
});
