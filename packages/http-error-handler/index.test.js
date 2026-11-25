import { deepStrictEqual, ok, strictEqual, throws } from "node:assert/strict";
import { describe, test } from "node:test";
import middy from "@middy/core";
import { HttpError } from "@middy/util";
import httpErrorHandler, { httpErrorHandlerValidateOptions } from "./index.js";

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const thenKey = "then";

describe("@middy/http-error-handler", () => {
	test("It should create a response for HTTP errors (string)", async (t) => {
		const handler = middy(() => {
			throw new HttpError(422);
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(null, defaultContext);

		deepStrictEqual(response, {
			statusCode: 422,
			body: "Unprocessable Entity",
			headers: {
				"Content-Type": "text/plain",
			},
		});
	});

	test("It should create a response for HTTP errors (json)", async (t) => {
		const handler = middy(() => {
			throw new Error();
		});

		handler.use(
			httpErrorHandler({
				logger: false,
				fallbackMessage: '{ "json": "error" }',
			}),
		);

		const response = await handler(defaultEvent, defaultContext);

		deepStrictEqual(response, {
			statusCode: 500,
			body: '{ "json": "error" }',
			headers: {
				"Content-Type": "application/json",
			},
		});
	});

	test("It should handle non HTTP errors when fallback not set", async (t) => {
		const handler = middy(() => {
			throw new Error("non-http error");
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);
		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	test("It should handle non HTTP errors when fallback set", async (t) => {
		const handler = middy(() => {
			throw new Error("non-http error");
		});

		handler.use(
			httpErrorHandler({ logger: false, fallbackMessage: "Error: unknown" }),
		);

		const response = await handler(defaultEvent, defaultContext);
		deepStrictEqual(response, {
			statusCode: 500,
			body: "Error: unknown",
			headers: {
				"Content-Type": "text/plain",
			},
		});
	});

	test("It should be possible to pass a custom logger function", async (t) => {
		const expectedError = new HttpError(422);
		const logger = t.mock.fn();

		const handler = middy(() => {
			throw expectedError;
		});

		handler.use(httpErrorHandler({ logger }));

		await handler(defaultEvent, defaultContext);

		strictEqual(logger.mock.calls[0].arguments[0].error, expectedError);
	});

	test("It should report a logger that rejects instead of leaving an unhandled rejection", async (t) => {
		const reported = t.mock.method(console, "error", () => {});
		const failure = new Error("log sink is down");
		const unhandled = [];
		const onUnhandledRejection = (reason) => {
			unhandled.push(reason);
		};
		process.on("unhandledRejection", onUnhandledRejection);
		t.after(() => process.off("unhandledRejection", onUnhandledRejection));

		const handler = middy(() => {
			throw new HttpError(422);
		}).use(
			httpErrorHandler({
				logger: async () => {
					throw failure;
				},
			}),
		);

		const response = await handler(defaultEvent, defaultContext);
		await new Promise((resolve) => setImmediate(resolve));

		deepStrictEqual(unhandled, []);
		strictEqual(reported.mock.calls.length, 1);
		strictEqual(reported.mock.calls[0].arguments[0], failure);
		deepStrictEqual(response, {
			statusCode: 422,
			body: "Unprocessable Entity",
			headers: {
				"Content-Type": "text/plain",
			},
		});
	});

	test("It should report a logger that throws and still return the response", async (t) => {
		const reported = t.mock.method(console, "error", () => {});
		const failure = new Error("log sink is down");

		const handler = middy(() => {
			throw new HttpError(422);
		}).use(
			httpErrorHandler({
				logger: () => {
					throw failure;
				},
			}),
		);

		const response = await handler(defaultEvent, defaultContext);

		strictEqual(reported.mock.calls.length, 1);
		strictEqual(reported.mock.calls[0].arguments[0], failure);
		strictEqual(response.statusCode, 422);
	});

	test("It should report a thenable from the logger that rejects", async (t) => {
		const reported = t.mock.method(console, "error", () => {});
		const failure = new Error("log sink is down");

		const handler = middy(() => {
			throw new HttpError(422);
		}).use(
			httpErrorHandler({
				logger: () => ({
					[thenKey]: (_resolve, reject) => reject(failure),
				}),
			}),
		);

		const response = await handler(defaultEvent, defaultContext);

		strictEqual(reported.mock.calls.length, 1);
		strictEqual(reported.mock.calls[0].arguments[0], failure);
		strictEqual(response.statusCode, 422);
	});

	test("It should wait for an asynchronous logger before replacing the error", async (t) => {
		const original = new Error("A leaky internal detail");
		let logged;

		const handler = middy(() => {
			throw original;
		}).use(
			httpErrorHandler({
				logger: async (request) => {
					await new Promise((resolve) => setImmediate(resolve));
					logged = request.error;
				},
			}),
		);

		const response = await handler(defaultEvent, defaultContext);

		strictEqual(logged, original);
		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	test("It should not use the logger's return value as the response", async (t) => {
		for (const result of ["logged", Promise.resolve("logged")]) {
			const handler = middy(() => {
				throw new HttpError(422);
			}).use(httpErrorHandler({ logger: () => result }));

			const response = await handler(defaultEvent, defaultContext);

			deepStrictEqual(response, {
				statusCode: 422,
				body: "Unprocessable Entity",
				headers: {
					"Content-Type": "text/plain",
				},
			});
		}
	});

	test("It should report nothing when the logger succeeds or is disabled", async (t) => {
		const reported = t.mock.method(console, "error", () => {});

		for (const logger of [() => {}, false]) {
			const handler = middy(() => {
				throw new HttpError(422);
			}).use(httpErrorHandler({ logger }));

			const response = await handler(defaultEvent, defaultContext);

			strictEqual(response.statusCode, 422);
		}

		strictEqual(reported.mock.calls.length, 0);
	});

	test("It should build the response synchronously when the logger returns no thenable", (t) => {
		const reported = t.mock.method(console, "error", () => {});

		for (const logger of [
			false,
			() => {},
			() => null,
			() => "logged",
			() => ({ level: "error" }),
		]) {
			const { onError } = httpErrorHandler({ logger });
			const request = {
				event: defaultEvent,
				context: defaultContext,
				error: new HttpError(422),
				response: undefined,
			};

			strictEqual(onError(request), undefined);
			strictEqual(request.response.statusCode, 422);
		}

		strictEqual(reported.mock.calls.length, 0);
	});

	test("It should be possible to pass in headers with error", async (t) => {
		const handler = middy(() => {
			const error = new HttpError(422);
			error.headers = {
				Location: "https://example.org/500",
			};
			throw error;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(null, defaultContext);

		deepStrictEqual(response, {
			statusCode: 422,
			body: "Unprocessable Entity",
			headers: {
				"Content-Type": "text/plain",
				Location: "https://example.org/500",
			},
		});
	});

	test("It should not expose an error that carries a statusCode without expose", async (t) => {
		const handler = middy(() => {
			const err = new Error("upstream detail");
			err.statusCode = 412;
			err.headers = { "Set-Cookie": "upstream=1" };
			throw err;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);

		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	test("It should create a response for a generic error that sets expose", async (t) => {
		const handler = middy(() => {
			const err = new Error("A client error");
			err.statusCode = 412;
			err.expose = true;
			throw err;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);

		deepStrictEqual(response, {
			statusCode: 412,
			body: "A client error",
			headers: {
				"Content-Type": "text/plain",
			},
		});
	});

	test("It should not expose an error whose expose is truthy but not true", async (t) => {
		const handler = middy(() => {
			const err = new Error("A client error");
			err.statusCode = 412;
			err.expose = "true";
			throw err;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);

		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	test("It should not expose an error whose statusCode is below 400", async (t) => {
		const handler = middy(() => {
			const err = new Error("Not an error status");
			err.statusCode = 399;
			err.expose = true;
			throw err;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);

		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	test("It should not expose an error whose statusCode is above 599", async (t) => {
		const handler = middy(() => {
			const err = new Error("Not an error status");
			err.statusCode = 600;
			err.expose = true;
			throw err;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);

		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	test("It should not expose an error whose statusCode is a numeric string", async (t) => {
		const handler = middy(() => {
			const err = new Error("Not a status");
			err.statusCode = "404";
			err.expose = true;
			throw err;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);

		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	test("It should not expose an error whose statusCode is not an integer", async (t) => {
		const handler = middy(() => {
			const err = new Error("Not a status");
			err.statusCode = 404.5;
			err.expose = true;
			throw err;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);

		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	test("It should expose an error at either end of the 400 to 599 range", async (t) => {
		for (const statusCode of [400, 599]) {
			const handler = middy(() => {
				const err = new Error("An http error");
				err.statusCode = statusCode;
				err.expose = true;
				throw err;
			});

			handler.use(httpErrorHandler({ logger: false }));

			const response = await handler(defaultEvent, defaultContext);

			deepStrictEqual(response, {
				statusCode,
				body: "An http error",
				headers: {
					"Content-Type": "text/plain",
				},
			});
		}
	});

	test("It should not modify the thrown error", async (t) => {
		const expectedError = Object.freeze(
			Object.assign(new Error("A frozen error"), { statusCode: 404 }),
		);
		let captured;
		const handler = middy(() => {
			throw expectedError;
		})
			.use({
				onError: (request) => {
					captured = request.error;
				},
			})
			.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);

		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
		strictEqual(captured.cause, expectedError);
		deepStrictEqual(Object.keys(expectedError), ["statusCode"]);
	});

	test("It should expose of error to user", async (t) => {
		const expectedError = new HttpError(404);

		const handler = middy(() => {
			throw expectedError;
		});

		handler.use(
			httpErrorHandler({ logger: false, fallbackMessage: "Error: unknown" }),
		);

		const response = await handler(defaultEvent, defaultContext);
		deepStrictEqual(response, {
			statusCode: 404,
			body: "Not Found",
			headers: {
				"Content-Type": "text/plain",
			},
		});
	});

	test("It should be possible to prevent expose of error to user", async (t) => {
		const expectedError = new HttpError(404, { expose: false });

		const handler = middy(() => {
			throw expectedError;
		});

		handler.use(
			httpErrorHandler({ logger: false, fallbackMessage: "Error: unknown" }),
		);

		const response = await handler(defaultEvent, defaultContext);
		deepStrictEqual(response, {
			statusCode: 500,
			body: "Error: unknown",
			headers: {
				"Content-Type": "text/plain",
			},
		});
	});

	test("It should not send error to user", async (t) => {
		const expectedError = new HttpError(500);

		const handler = middy(() => {
			throw expectedError;
		});

		handler.use(
			httpErrorHandler({ logger: false, fallbackMessage: "Error: unknown" }),
		);

		const response = await handler(defaultEvent, defaultContext);
		deepStrictEqual(response, {
			statusCode: 500,
			body: "Error: unknown",
			headers: {
				"Content-Type": "text/plain",
			},
		});
	});

	test("It should be possible to force expose of error to user", async (t) => {
		const expectedError = new HttpError(500, { expose: true });

		const handler = middy(() => {
			throw expectedError;
		});

		handler.use(
			httpErrorHandler({ logger: false, fallbackMessage: "Error: unknown" }),
		);

		const response = await handler(defaultEvent, defaultContext);
		deepStrictEqual(response, {
			statusCode: 500,
			body: "Internal Server Error",
			headers: {
				"Content-Type": "text/plain",
			},
		});
	});

	test("It should allow later middleware to modify the response", async (t) => {
		const handler = middy(() => {
			throw new HttpError(422);
		});

		handler
			.onError((request) => {
				request.response.headers["X-DNS-Prefetch-Control"] = "off";
			})
			.use(httpErrorHandler({ logger: false }));

		const response = await handler(null, defaultContext);

		deepStrictEqual(response, {
			statusCode: 422,
			body: "Unprocessable Entity",
			headers: {
				"Content-Type": "text/plain",
				"X-DNS-Prefetch-Control": "off",
			},
		});
	});

	test("It should not handle error is response is set", async (t) => {
		const handler = middy(() => {
			throw new HttpError(422);
		});

		handler.use(httpErrorHandler({ logger: false })).onError((request) => {
			request.response = true;
		});

		const response = await handler(null, defaultContext);

		ok(response);
	});

	test("It should return the 500 fallback when a non-object is thrown", async (t) => {
		const handler = middy(() => {
			throw null;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);
		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	test("It should return the 500 fallback when a primitive is thrown", async (t) => {
		const handler = middy(() => {
			throw "boom";
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);
		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	test("It should keep an error-supplied Content-Type header", async (t) => {
		const handler = middy(() => {
			const error = new HttpError(422);
			error.headers = {
				"Content-Type": "application/xml",
			};
			throw error;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(null, defaultContext);

		deepStrictEqual(response, {
			statusCode: 422,
			body: "Unprocessable Entity",
			headers: {
				"Content-Type": "application/xml",
			},
		});
	});

	test("It should use the default console.error logger when none is provided", async (t) => {
		const write = t.mock.method(process.stderr, "write", () => true);

		const handler = middy(() => {
			throw new HttpError(422);
		});

		handler.use(httpErrorHandler());

		const response = await handler(defaultEvent, defaultContext);

		ok(write.mock.calls.length >= 1);
		deepStrictEqual(response, {
			statusCode: 422,
			body: "Unprocessable Entity",
			headers: {
				"Content-Type": "text/plain",
			},
		});
	});

	test("It should leave an already-set response untouched", async (t) => {
		const handler = middy(() => {
			throw new HttpError(422);
		});

		handler.use(httpErrorHandler({ logger: false })).onError((request) => {
			request.response = "already-handled";
		});

		const response = await handler(defaultEvent, defaultContext);

		strictEqual(response, "already-handled");
	});

	test("It should fall back to 500 for a non-object error carrying http properties", async (t) => {
		const errorFn = () => {};
		errorFn.statusCode = 422;
		errorFn.expose = true;
		errorFn.message = "should be ignored";

		const handler = middy(() => {
			throw errorFn;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);

		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	test("It should not expose a generic error with statusCode 500 and no expose", async (t) => {
		const handler = middy(() => {
			const err = new Error("A server error");
			err.statusCode = 500;
			throw err;
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);

		deepStrictEqual(response, {
			statusCode: 500,
			headers: {},
		});
	});

	// `request.error` is replaced with the generic fallback for non-http errors,
	// and stays visible to any onError middleware registered ahead of this one
	// (onError runs in reverse registration order). Pin that published shape: an
	// `Error` carrying the original as `cause`, so nothing is lost downstream.
	test("It should replace a non-http error with an exposable generic 500 that keeps the original as cause", async (t) => {
		const original = new Error("A leaky internal detail");
		let captured;
		const handler = middy(() => {
			throw original;
		})
			.use({
				onError: (request) => {
					captured = request.error;
				},
			})
			.use(
				httpErrorHandler({
					logger: false,
					fallbackMessage: "Internal Server Error",
				}),
			);

		const response = await handler(defaultEvent, defaultContext);

		ok(captured instanceof Error);
		strictEqual(captured.cause, original);
		strictEqual(captured.statusCode, 500);
		strictEqual(captured.message, "Internal Server Error");
		strictEqual(captured.expose, true);
		deepStrictEqual(response, {
			statusCode: 500,
			body: "Internal Server Error",
			headers: {
				"Content-Type": "text/plain",
			},
		});
	});

	test("It should keep a non-exposed http error as the cause of the generic 500", async (t) => {
		const original = new HttpError(503, { expose: false });
		let captured;
		const handler = middy(() => {
			throw original;
		})
			.use({
				onError: (request) => {
					captured = request.error;
				},
			})
			.use(httpErrorHandler({ logger: false }));

		const response = await handler(defaultEvent, defaultContext);

		ok(captured instanceof Error);
		strictEqual(captured.cause, original);
		strictEqual(captured.statusCode, 500);
		deepStrictEqual(response, { statusCode: 500, headers: {} });
	});

	test("httpErrorHandlerValidateOptions accepts valid options and rejects typos", () => {
		httpErrorHandlerValidateOptions({ logger: () => {}, fallbackMessage: "x" });
		httpErrorHandlerValidateOptions({ logger: false });
		httpErrorHandlerValidateOptions({});
		try {
			httpErrorHandlerValidateOptions({ fallbckMessage: "x" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/http-error-handler");
		}
	});

	test("httpErrorHandlerValidateOptions rejects wrong type", () => {
		try {
			httpErrorHandlerValidateOptions({ fallbackMessage: 42 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("fallbackMessage"));
		}
	});

	test("httpErrorHandlerValidateOptions accepts a multi-line or Unicode fallbackMessage", () => {
		httpErrorHandlerValidateOptions({
			fallbackMessage: '{\n\t"message": "Erreur: réessayez"\r\n}',
		});
		httpErrorHandlerValidateOptions({ fallbackMessage: "" });
	});

	test("httpErrorHandlerValidateOptions rejects a fallbackMessage with a control character", () => {
		throws(
			() => httpErrorHandlerValidateOptions({ fallbackMessage: "a\u0000b" }),
			{ name: "TypeError" },
		);
	});

	test("httpErrorHandlerValidateOptions rejects a fallbackMessage or mask longer than 1024 characters", () => {
		httpErrorHandlerValidateOptions({
			fallbackMessage: "a".repeat(1024),
			mask: "*".repeat(1024),
		});
		throws(
			() =>
				httpErrorHandlerValidateOptions({ fallbackMessage: "a".repeat(1025) }),
			{ message: "Option 'fallbackMessage' must have length <= 1024" },
		);
		throws(() => httpErrorHandlerValidateOptions({ mask: "*".repeat(1025) }), {
			message: "Option 'mask' must have length <= 1024",
		});
	});

	test("httpErrorHandlerValidateOptions rejects a mask with a control character", () => {
		throws(() => httpErrorHandlerValidateOptions({ mask: "\n" }), {
			name: "TypeError",
		});
		httpErrorHandlerValidateOptions({ mask: "***omitted***" });
		httpErrorHandlerValidateOptions({ mask: "" });
	});

	test("httpErrorHandlerValidateOptions accepts a logger function or false only", () => {
		httpErrorHandlerValidateOptions({ logger: async () => {} });
		for (const logger of [true, "console", {}]) {
			throws(() => httpErrorHandlerValidateOptions({ logger }), {
				message: "Option 'logger' must match exactly one schema in oneOf",
			});
		}
	});

	test("It should redact omitPaths from the error before logging", async (t) => {
		let captured = null;

		const handler = middy(() => {
			throw new HttpError(422, {
				cause: {
					package: "@middy/http-json-body-parser",
					data: { reason: "Invalid JSON", body: "ssn=123-45-6789" },
				},
			});
		}).use(
			httpErrorHandler({
				logger: (request) => (captured = request),
				omitPaths: ["error.cause.data.body"],
				mask: "[redacted]",
			}),
		);

		const response = await handler(defaultEvent, defaultContext);

		strictEqual(captured.error.cause.data.body, "[redacted]");
		strictEqual(captured.error.cause.data.reason, "Invalid JSON");
		strictEqual(captured.error.statusCode, 422);
		strictEqual(response.statusCode, 422);
		strictEqual(response.body, "Unprocessable Entity");
	});

	test("It should redact omitPaths outside the error", async (t) => {
		let captured = null;

		const handler = middy(() => {
			throw new HttpError(500);
		}).use(
			httpErrorHandler({
				logger: (request) => (captured = request),
				omitPaths: ["event.headers.authorization"],
			}),
		);

		await handler(
			{ headers: { authorization: "Bearer x", accept: "*" } },
			defaultContext,
		);

		deepStrictEqual(captured.event, { headers: { accept: "*" } });
	});

	test("It should pass the request through untouched when no omitPaths are set", async (t) => {
		const error = new HttpError(500);
		let captured = null;

		// Captured at log time: `request.error` is swapped for the fallback after.
		const handler = middy(() => {
			throw error;
		}).use(
			httpErrorHandler({
				logger: (request) => (captured = { request, error: request.error }),
			}),
		);

		await handler(defaultEvent, defaultContext);

		strictEqual(captured.error, error);
	});

	test("httpErrorHandlerValidateOptions accepts omitPaths and mask", () => {
		httpErrorHandlerValidateOptions({ omitPaths: ["error.cause"], mask: "**" });
		try {
			httpErrorHandlerValidateOptions({ omitPaths: "error.cause" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("omitPaths"));
		}
	});

	test("httpErrorHandlerValidateOptions accepts an omitPaths entry given as an array of segments", () => {
		const options = {
			omitPaths: ["error.cause", ["event", "headers", "x.api.key"]],
		};
		strictEqual(httpErrorHandlerValidateOptions(options), options);
	});

	test("httpErrorHandlerValidateOptions rejects an omitPaths entry that is neither a string nor an array of strings", () => {
		for (const omitPaths of [[1], [["event", 1]], [{ path: "event" }]]) {
			try {
				httpErrorHandlerValidateOptions({ omitPaths });
				ok(false, "expected throw");
			} catch (e) {
				ok(e instanceof TypeError);
				ok(e.message.includes("omitPaths[0]"));
			}
		}
	});

	test("httpErrorHandlerValidateOptions rejects an omitPaths entry the middleware would reject", () => {
		for (const omitPaths of [
			["event.Records[].body"],
			["event.Records.0.body"],
			[["event", "__proto__"]],
		]) {
			let thrown;
			try {
				httpErrorHandlerValidateOptions({ omitPaths });
			} catch (e) {
				thrown = e;
			}
			ok(thrown instanceof TypeError);
			ok(thrown.message.startsWith("Invalid path "));
			strictEqual(thrown.cause.package, "@middy/util");

			let thrownByFactory;
			try {
				httpErrorHandler({ omitPaths });
			} catch (e) {
				thrownByFactory = e;
			}
			strictEqual(thrownByFactory.message, thrown.message);
		}
	});

	test("httpErrorHandlerValidateOptions rejects an omitPaths entry that is an empty array", () => {
		let thrown;
		try {
			httpErrorHandlerValidateOptions({ omitPaths: [[]] });
		} catch (e) {
			thrown = e;
		}
		ok(thrown instanceof TypeError);
		ok(thrown.message.includes("omitPaths[0]"));
		strictEqual(thrown.cause.package, "@middy/http-error-handler");
	});

	test("It should redact a key containing a dot through an array omitPaths entry", async (t) => {
		let captured = null;

		const handler = middy(() => {
			throw new HttpError(422);
		}).use(
			httpErrorHandler({
				logger: (request) => {
					captured = request;
				},
				omitPaths: [["event", "headers", "x.api.key"]],
				mask: "[redacted]",
			}),
		);

		await handler(
			{ headers: { "x.api.key": "secret", accept: "*/*" } },
			defaultContext,
		);

		deepStrictEqual(captured.event.headers, {
			"x.api.key": "[redacted]",
			accept: "*/*",
		});
	});

	// `message` and `cause` are non-enumerable on an Error, so a downstream logger
	// that does `JSON.stringify(request.error)` would otherwise see only
	// `{ statusCode, expose }`.
	test("It should serialize the generic 500 fallback to JSON with its message and cause", async (t) => {
		let serialized;
		const handler = middy(() => {
			throw new Error("A leaky internal detail");
		})
			.use({
				onError: (request) => {
					serialized = JSON.stringify(request.error);
				},
			})
			.use(
				httpErrorHandler({
					logger: false,
					fallbackMessage: "Internal Server Error",
				}),
			);

		await handler(defaultEvent, defaultContext);

		deepStrictEqual(JSON.parse(serialized), {
			statusCode: 500,
			message: "Internal Server Error",
			expose: true,
			cause: { name: "Error", message: "A leaky internal detail" },
		});
	});

	test("It should serialize a primitive cause on the generic 500 fallback as itself", async (t) => {
		let serialized;
		const handler = middy(() => {
			throw "boom";
		})
			.use({
				onError: (request) => {
					serialized = JSON.stringify(request.error);
				},
			})
			.use(httpErrorHandler({ logger: false }));

		await handler(defaultEvent, defaultContext);

		deepStrictEqual(JSON.parse(serialized), {
			statusCode: 500,
			message: "",
			expose: true,
			cause: "boom",
		});
	});

	// `throw null` reaches onError as `request.error === null`; the fallback still
	// has to serialize (a downstream logger must not blow up on a nullish cause).
	test("It should serialize a null cause on the generic 500 fallback as null", async (t) => {
		let serialized;
		const handler = middy(() => {
			throw null;
		})
			.use({
				onError: (request) => {
					serialized = JSON.stringify(request.error);
				},
			})
			.use(httpErrorHandler({ logger: false }));

		await handler(defaultEvent, defaultContext);

		deepStrictEqual(JSON.parse(serialized), {
			statusCode: 500,
			message: "",
			expose: true,
			cause: null,
		});
	});

	// A cause that is itself an Error keeps its `name` and `message` and, when it
	// has one, its own `cause`, all the way down. Reducing it to a single message
	// string lost every layer below the first; the stack stays out of the JSON.
	test("It should serialize a nested Error cause on the generic 500 fallback recursively", async (t) => {
		let serialized;
		const handler = middy(() => {
			throw new Error("outer", {
				cause: new TypeError("middle", { cause: new RangeError("inner") }),
			});
		})
			.use({
				onError: (request) => {
					serialized = JSON.stringify(request.error);
				},
			})
			.use(httpErrorHandler({ logger: false }));

		await handler(defaultEvent, defaultContext);

		deepStrictEqual(JSON.parse(serialized), {
			statusCode: 500,
			message: "",
			expose: true,
			cause: {
				name: "Error",
				message: "outer",
				cause: {
					name: "TypeError",
					message: "middle",
					cause: { name: "RangeError", message: "inner" },
				},
			},
		});
	});

	// A cause that is not an Error is handed to JSON.stringify as it is. Every
	// HttpError in middy carries a plain `{ package, data }` object as its cause;
	// reducing that to `{ name, message }` would drop both fields.
	test("It should serialize a plain-object cause on the generic 500 fallback as it is", async (t) => {
		let serialized;
		const handler = middy(() => {
			throw new HttpError(500, {
				cause: { package: "@middy/example", data: { reason: "why" } },
			});
		})
			.use({
				onError: (request) => {
					serialized = JSON.stringify(request.error);
				},
			})
			.use(httpErrorHandler({ logger: false }));

		await handler(defaultEvent, defaultContext);

		deepStrictEqual(JSON.parse(serialized), {
			statusCode: 500,
			message: "",
			expose: true,
			cause: {
				name: "InternalServerError",
				message: "Internal Server Error",
				cause: { package: "@middy/example", data: { reason: "why" } },
			},
		});
	});

	// JSON.stringify drops keys whose value is `undefined`, so only the object
	// `toJSON()` hands back shows whether a `cause` key was added for nothing.
	test("It should serialize an Error cause without a cause of its own with no cause key", async (t) => {
		let serialized;
		let json;
		const handler = middy(() => {
			throw new Error("plain");
		})
			.use({
				onError: (request) => {
					serialized = JSON.stringify(request.error);
					json = request.error.toJSON();
				},
			})
			.use(httpErrorHandler({ logger: false }));

		await handler(defaultEvent, defaultContext);

		ok(!Object.hasOwn(JSON.parse(serialized).cause, "cause"));
		deepStrictEqual(json, {
			statusCode: 500,
			message: "",
			expose: true,
			cause: { name: "Error", message: "plain" },
		});
	});

	// `throw undefined` reaches onError as `request.error === undefined`; the
	// fallback has nothing to report as a cause, so the key is left out.
	test("It should serialize an undefined cause on the generic 500 fallback with no cause key", async (t) => {
		let serialized;
		const handler = middy(() => {
			throw undefined;
		})
			.use({
				onError: (request) => {
					serialized = JSON.stringify(request.error);
				},
			})
			.use(httpErrorHandler({ logger: false }));

		await handler(defaultEvent, defaultContext);

		deepStrictEqual(JSON.parse(serialized), {
			statusCode: 500,
			message: "",
			expose: true,
		});
	});

	// An error whose cause chain loops back on itself must not recurse forever.
	test("It should serialize a self-referencing cause on the generic 500 fallback without looping", async (t) => {
		let serialized;
		const handler = middy(() => {
			const error = new Error("loop");
			error.cause = error;
			throw error;
		})
			.use({
				onError: (request) => {
					serialized = JSON.stringify(request.error);
				},
			})
			.use(httpErrorHandler({ logger: false }));

		await handler(defaultEvent, defaultContext);

		deepStrictEqual(JSON.parse(serialized), {
			statusCode: 500,
			message: "",
			expose: true,
			cause: { name: "Error", message: "loop", cause: "[Circular]" },
		});
	});

	// ALB with multi-value headers enabled only reads `multiValueHeaders`: "You
	// must use multiValueHeaders if you have enabled multi-value headers and
	// headers otherwise."
	// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers
	test("It should write headers into multiValueHeaders for an ALB multi-value event", async (t) => {
		const handler = middy(() => {
			throw Object.assign(new HttpError(401), {
				headers: { "WWW-Authenticate": "Bearer", Link: ["<a>", "<b>"] },
			});
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(
			{
				requestContext: { elb: { targetGroupArn: "arn" } },
				multiValueHeaders: {},
			},
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 401,
			body: "Unauthorized",
			headers: {},
			multiValueHeaders: {
				"Content-Type": ["text/plain"],
				"WWW-Authenticate": ["Bearer"],
				Link: ["<a>", "<b>"],
			},
		});
	});

	test("It should keep headers for an ALB event without multi-value headers", async (t) => {
		const handler = middy(() => {
			throw Object.assign(new HttpError(401), {
				headers: { "WWW-Authenticate": "Bearer" },
			});
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(
			{ requestContext: { elb: { targetGroupArn: "arn" } }, headers: {} },
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 401,
			body: "Unauthorized",
			headers: { "Content-Type": "text/plain", "WWW-Authenticate": "Bearer" },
		});
	});

	test("It should keep headers for an API Gateway REST event with multiValueHeaders", async (t) => {
		const handler = middy(() => {
			throw Object.assign(new HttpError(401), {
				headers: { "WWW-Authenticate": "Bearer" },
			});
		});

		handler.use(httpErrorHandler({ logger: false }));

		const response = await handler(
			{ requestContext: {}, headers: {}, multiValueHeaders: {} },
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 401,
			body: "Unauthorized",
			headers: { "Content-Type": "text/plain", "WWW-Authenticate": "Bearer" },
		});
	});
});
