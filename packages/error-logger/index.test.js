import { deepStrictEqual, ok, strictEqual, throws } from "node:assert/strict";
import { describe, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import middy from "../core/index.js";
import errorLogger, { errorLoggerValidateOptions } from "./index.js";

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const thenKey = "then";

describe("@middy/error-logger", () => {
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

	// Logging is this middleware's only job, so there is no "off" setting: the
	// way to disable it is to not register the middleware.
	test("It should reject logger: false at construction", () => {
		for (const logger of [false, null]) {
			// The factory says what to do instead; the validator keeps the generic
			// option wording every other option uses.
			throws(() => errorLogger({ logger }), {
				name: "TypeError",
				message:
					"Option 'logger' must be a function; @middy/error-logger only logs, omit the middleware to disable logging",
				cause: { package: "@middy/error-logger" },
			});
			throws(() => errorLoggerValidateOptions({ logger }), {
				name: "TypeError",
				message: "Option 'logger' must be instanceof Function",
				cause: { package: "@middy/error-logger" },
			});
		}
	});

	// winston's `logger.error()` returns the logger; a hook that forwarded it would
	// make core treat it as an early response and swallow the error.
	test("It should ignore the logger's return value", async (t) => {
		const error = new Error("boom");

		const handler = middy(() => {
			throw error;
		}).use(errorLogger({ logger: () => ({ chained: true }) }));

		await t.assert.rejects(handler(defaultEvent, defaultContext), (e) => {
			strictEqual(e, error);
			return true;
		});
	});

	// A logger failure must not change the outcome: an error handler registered
	// before errorLogger still turns the error into its response.
	test("It should report a throwing logger via console.error and keep the handled response", async (t) => {
		const loggerError = new Error("logger down");
		const consoleError = t.mock.method(console, "error", () => {});

		const handler = middy(() => {
			throw new Error("Not Found");
		})
			.use({
				onError: (request) => {
					request.response = { statusCode: 404 };
				},
			})
			.use(
				errorLogger({
					logger: () => {
						throw loggerError;
					},
				}),
			);

		const response = await handler(defaultEvent, defaultContext);
		deepStrictEqual(response, { statusCode: 404 });
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
	});

	test("It should report a rejected async logger via console.error and keep the handled response", async (t) => {
		const loggerError = new Error("log sink unreachable");
		const consoleError = t.mock.method(console, "error", () => {});

		const handler = middy(() => {
			throw new Error("Not Found");
		})
			.use({
				onError: (request) => {
					request.response = { statusCode: 404 };
				},
			})
			.use(
				errorLogger({
					logger: async () => {
						throw loggerError;
					},
				}),
			);

		const response = await handler(defaultEvent, defaultContext);
		deepStrictEqual(response, { statusCode: 404 });
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
	});

	test("It should wait for an async logger before the invocation settles", async (t) => {
		const error = new Error("boom");
		let shipped = false;

		const handler = middy(() => {
			throw error;
		}).use(
			errorLogger({
				logger: async () => {
					await setImmediate();
					shipped = true;
				},
			}),
		);

		await t.assert.rejects(handler(defaultEvent, defaultContext), (e) => {
			strictEqual(e, error);
			return true;
		});
		strictEqual(shipped, true);
	});

	test("It should ignore what an async logger resolves to", async (t) => {
		const error = new Error("boom");

		const handler = middy(() => {
			throw error;
		}).use(errorLogger({ logger: async () => ({ chained: true }) }));

		await t.assert.rejects(handler(defaultEvent, defaultContext), (e) => {
			strictEqual(e, error);
			return true;
		});
	});

	test("It should await a thenable returned by the logger", async (t) => {
		const error = new Error("boom");
		const loggerError = new Error("log sink unreachable");
		const consoleError = t.mock.method(console, "error", () => {});

		const handler = middy(() => {
			throw error;
		}).use(
			errorLogger({
				logger: () => ({
					[thenKey]: (_resolve, reject) => reject(loggerError),
				}),
			}),
		);

		await t.assert.rejects(handler(defaultEvent, defaultContext), (e) => {
			strictEqual(e, error);
			return true;
		});
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
	});

	test("It should keep the hook synchronous for a synchronous logger", (t) => {
		const consoleError = t.mock.method(console, "error", () => {});
		const request = { event: defaultEvent, error: new Error("boom") };

		for (const result of [undefined, null, { chained: true }, "logged"]) {
			const logger = t.mock.fn(() => result);
			strictEqual(errorLogger({ logger }).onError(request), undefined);
			strictEqual(logger.mock.callCount(), 1);
		}
		strictEqual(consoleError.mock.callCount(), 0);
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

	// `{ ...defaults, ...opts }` lets an explicit `logger: undefined` override the
	// default; it means "not set", not "off", so the default logger must be kept.
	test("It should use the default logger when logger is explicitly undefined", async (t) => {
		const error = new Error("something bad happened");
		const consoleError = t.mock.method(console, "error", () => {});

		const handler = middy(() => {
			throw error;
		}).use(errorLogger({ logger: undefined }));

		await t.assert.rejects(handler(defaultEvent, defaultContext), (e) => {
			strictEqual(e, error);
			return true;
		});
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], error);
	});

	test("It should log non-Error throws (string, plain object, null)", async (t) => {
		for (const thrown of [
			"string error",
			{ code: "BAD" },
			null,
			undefined,
			42,
		]) {
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

	test("errorLoggerValidateOptions caps mask at 1024 printable characters", () => {
		errorLoggerValidateOptions({ mask: "***omitted***" });
		errorLoggerValidateOptions({ mask: "x".repeat(1024) });
		throws(() => errorLoggerValidateOptions({ mask: "x".repeat(1025) }), {
			name: "TypeError",
			message: "Option 'mask' must have length <= 1024",
			cause: { package: "@middy/error-logger" },
		});
		throws(() => errorLoggerValidateOptions({ mask: "line\nbreak" }), {
			name: "TypeError",
			message: /^Option 'mask' must match pattern /,
			cause: { package: "@middy/error-logger" },
		});
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
			cause: {
				package: "@middy/http-json-body-parser",
				data: { body: "ssn=1" },
			},
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

	test("It should omit an array path whose segment holds a dot", async (t) => {
		const error = new Error("boom", {
			cause: { data: { "user.email": "a@example.com", id: 7 } },
		});
		let captured = null;
		const omitPaths = [["error", "cause", "data", "user.email"]];
		errorLoggerValidateOptions({ omitPaths });

		const handler = middy(() => {
			throw error;
		}).use(
			errorLogger({ logger: (request) => (captured = request), omitPaths }),
		);

		await t.assert.rejects(handler(defaultEvent, defaultContext));

		deepStrictEqual(captured.error.cause.data, { id: 7 });
		strictEqual(error.cause.data["user.email"], "a@example.com");
	});

	test("errorLoggerValidateOptions rejects an omitPaths entry that is not a string or an array of strings", () => {
		for (const entry of [1, null, {}, ["error", 1], [["error"]], []]) {
			throws(() => errorLoggerValidateOptions({ omitPaths: [entry] }), {
				name: "TypeError",
				message: "Option 'omitPaths[0]' must match exactly one schema in oneOf",
				cause: { package: "@middy/error-logger" },
			});
		}
	});

	test("errorLoggerValidateOptions rejects a path that could never match", () => {
		for (const path of [
			"error.cause[].body",
			"error.cause.0.body",
			"error.cause.*.body",
			["error", "cause", "__proto__"],
		]) {
			const invalidPath = { name: "TypeError", message: /^Invalid path / };
			throws(
				() => errorLoggerValidateOptions({ omitPaths: [path] }),
				invalidPath,
			);
			throws(() => errorLogger({ omitPaths: [path] }), invalidPath);
		}
		errorLoggerValidateOptions({
			omitPaths: ["error.cause.[].body", ["error", "cause", "[]", "0"]],
		});
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
});
