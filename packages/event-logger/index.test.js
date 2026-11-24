import { deepStrictEqual, ok, strictEqual, throws } from "node:assert/strict";
import { describe, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import middy from "../core/index.js";
import eventLogger, { eventLoggerValidateOptions } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const thenKey = "then";

describe("@middy/event-logger", () => {
	test("It should log the event", async (t) => {
		const logger = t.mock.fn();

		const handler = middy((event) => event).use(eventLogger({ logger }));

		const event = { foo: "bar", fuu: "baz" };
		const response = await handler(event, defaultContext);

		strictEqual(logger.mock.callCount(), 1);
		strictEqual(logger.mock.calls[0].arguments[0].event, event);
		deepStrictEqual(response, event);
	});

	test("It should hand the logger the whole request", async (t) => {
		const logger = t.mock.fn();

		const handler = middy((event) => event).use(eventLogger({ logger }));

		const event = { foo: "bar" };
		await handler(event, defaultContext);

		const [request] = logger.mock.calls[0].arguments;
		strictEqual(request.event, event);
		strictEqual(request.context, defaultContext);
		ok("internal" in request);
		ok("response" in request);
	});

	test("It should log the event before the handler throws", async (t) => {
		const logger = t.mock.fn();

		const handler = middy(() => {
			throw new Error("boom");
		}).use(eventLogger({ logger }));

		const event = { foo: "bar" };
		try {
			await handler(event, defaultContext);
		} catch (e) {
			strictEqual(e.message, "boom");
		}

		strictEqual(logger.mock.callCount(), 1);
		strictEqual(logger.mock.calls[0].arguments[0].event, event);
	});

	test("It should use the default logger when none is provided", async (t) => {
		const originalLog = console.log;
		const logCalls = [];
		console.log = (message) => {
			logCalls.push(message);
		};

		const handler = middy((event) => event).use(eventLogger());

		const event = { foo: "bar" };
		const response = await handler(event, defaultContext);

		console.log = originalLog;

		strictEqual(logCalls.length, 1);
		deepStrictEqual(JSON.parse(logCalls[0]), { event });
		deepStrictEqual(response, event);
	});

	// `{ ...defaults, ...opts }` lets an explicit `logger: undefined` override the
	// default; it means "not set", not "off", so the default logger must be kept.
	test("It should use the default logger when logger is explicitly undefined", async (t) => {
		const log = t.mock.method(console, "log", () => {});

		const handler = middy((event) => event).use(
			eventLogger({ logger: undefined }),
		);

		const event = { foo: "bar" };
		deepStrictEqual(await handler(event, defaultContext), event);

		strictEqual(log.mock.callCount(), 1);
		deepStrictEqual(JSON.parse(log.mock.calls[0].arguments[0]), { event });
	});

	// event-normalizer turns DynamoDB N values beyond 2^53 into BigInt, which
	// JSON.stringify cannot serialize on its own.
	test("It should log BigInt values as strings with the default logger", async (t) => {
		const log = t.mock.method(console, "log", () => {});

		const handler = middy((event) => event).use(eventLogger());

		const event = { id: 2n ** 64n };
		await handler(event, defaultContext);

		strictEqual(log.mock.callCount(), 1);
		deepStrictEqual(JSON.parse(log.mock.calls[0].arguments[0]), {
			event: { id: "18446744073709551616" },
		});
	});

	// Logging is this middleware's only job, so there is no "off" setting: the
	// way to disable it is to not register the middleware.
	test("It should reject logger: false at construction", () => {
		for (const logger of [false, null]) {
			// The factory says what to do instead; the validator keeps the generic
			// option wording every other option uses.
			throws(() => eventLogger({ logger }), {
				name: "TypeError",
				message:
					"Option 'logger' must be a function; @middy/event-logger only logs, omit the middleware to disable logging",
				cause: { package: "@middy/event-logger" },
			});
			throws(() => eventLoggerValidateOptions({ logger }), {
				name: "TypeError",
				message: "Option 'logger' must be instanceof Function",
				cause: { package: "@middy/event-logger" },
			});
		}
	});

	// winston's `logger.info()` returns the logger; a hook that forwarded it would
	// make core treat it as an early response and skip the handler.
	test("It should ignore the logger's return value", async (t) => {
		const lambdaHandler = t.mock.fn(() => "handler");

		const handler = middy(lambdaHandler).use(
			eventLogger({ logger: () => ({ chained: true }) }),
		);

		const response = await handler({ foo: "bar" }, defaultContext);

		strictEqual(lambdaHandler.mock.callCount(), 1);
		strictEqual(response, "handler");
	});

	// A logger failure must not change the outcome: the handler still runs.
	test("It should report a throwing logger via console.error and still run the handler", async (t) => {
		const loggerError = new Error("logger down");
		const consoleError = t.mock.method(console, "error", () => {});
		const lambdaHandler = t.mock.fn(() => "handler");

		const handler = middy(lambdaHandler).use(
			eventLogger({
				logger: () => {
					throw loggerError;
				},
			}),
		);

		const response = await handler({ foo: "bar" }, defaultContext);

		strictEqual(response, "handler");
		strictEqual(lambdaHandler.mock.callCount(), 1);
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
	});

	test("It should report a rejected async logger via console.error and still run the handler", async (t) => {
		const loggerError = new Error("log sink unreachable");
		const consoleError = t.mock.method(console, "error", () => {});
		const lambdaHandler = t.mock.fn(() => "handler");

		const handler = middy(lambdaHandler).use(
			eventLogger({
				logger: async () => {
					throw loggerError;
				},
			}),
		);

		const response = await handler({ foo: "bar" }, defaultContext);

		strictEqual(response, "handler");
		strictEqual(lambdaHandler.mock.callCount(), 1);
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
	});

	test("It should wait for an async logger before running the handler", async (t) => {
		const order = [];

		const handler = middy(() => {
			order.push("handler");
		}).use(
			eventLogger({
				logger: async () => {
					await setImmediate();
					order.push("logger");
				},
			}),
		);

		await handler({ foo: "bar" }, defaultContext);

		deepStrictEqual(order, ["logger", "handler"]);
	});

	test("It should ignore what an async logger resolves to", async (t) => {
		const lambdaHandler = t.mock.fn(() => "handler");

		const handler = middy(lambdaHandler).use(
			eventLogger({ logger: async () => ({ chained: true }) }),
		);

		const response = await handler({ foo: "bar" }, defaultContext);

		strictEqual(lambdaHandler.mock.callCount(), 1);
		strictEqual(response, "handler");
	});

	test("It should await a thenable returned by the logger", async (t) => {
		const loggerError = new Error("log sink unreachable");
		const consoleError = t.mock.method(console, "error", () => {});
		const order = [];

		const handler = middy(() => {
			order.push("handler");
			return "handler";
		}).use(
			eventLogger({
				logger: () => ({
					[thenKey]: (_resolve, reject) => {
						order.push("logger");
						reject(loggerError);
					},
				}),
			}),
		);

		const response = await handler({ foo: "bar" }, defaultContext);

		strictEqual(response, "handler");
		deepStrictEqual(order, ["logger", "handler"]);
		strictEqual(consoleError.mock.callCount(), 1);
		strictEqual(consoleError.mock.calls[0].arguments[0], loggerError);
	});

	test("It should keep the hook synchronous for a synchronous logger", (t) => {
		const consoleError = t.mock.method(console, "error", () => {});
		const request = { event: { foo: "bar" } };

		for (const result of [undefined, null, { chained: true }, "logged"]) {
			const logger = t.mock.fn(() => result);
			strictEqual(eventLogger({ logger }).before(request), undefined);
			strictEqual(logger.mock.callCount(), 1);
		}
		strictEqual(consoleError.mock.callCount(), 0);
	});

	test("It should omit paths", async (t) => {
		const logger = t.mock.fn();

		const handler = middy((event) => event).use(
			eventLogger({ logger, omitPaths: ["event.foo"] }),
		);

		const event = { foo: "foo", bar: "bar" };
		await handler(event, defaultContext);

		deepStrictEqual(logger.mock.calls[0].arguments[0].event, { bar: "bar" });
		// copy-on-write: the real event is untouched
		strictEqual(event.foo, "foo");
	});

	test("It should mask paths", async (t) => {
		const logger = t.mock.fn();

		const handler = middy((event) => event).use(
			eventLogger({
				logger,
				omitPaths: ["event.headers.authorization"],
				mask: "*****",
			}),
		);

		await handler(
			{ headers: { authorization: "Bearer secret", accept: "*/*" } },
			defaultContext,
		);

		deepStrictEqual(logger.mock.calls[0].arguments[0].event, {
			headers: { authorization: "*****", accept: "*/*" },
		});
	});

	// `internal` holds resolved secrets and is now reachable by the logger.
	test("It should omit paths outside the event", async (t) => {
		const logger = t.mock.fn();

		const handler = middy((event) => event)
			.use({
				before: (request) => {
					request.internal.DB_PASSWORD = "hunter2";
				},
			})
			.use(eventLogger({ logger, omitPaths: ["internal.DB_PASSWORD"] }));

		await handler({ foo: "bar" }, defaultContext);

		strictEqual(
			Object.hasOwn(logger.mock.calls[0].arguments[0].internal, "DB_PASSWORD"),
			false,
		);
	});

	test("It should pass the request through untouched when no omitPaths are set", async (t) => {
		const logger = t.mock.fn();

		const handler = middy((event) => event).use(eventLogger({ logger }));

		await handler({ foo: "bar" }, defaultContext);

		ok("internal" in logger.mock.calls[0].arguments[0]);
	});

	test("It should not mutate the caller-provided omitPaths array", async (t) => {
		const logger = t.mock.fn();
		const omitPaths = ["event.foo", "event.bar"];
		const original = [...omitPaths];

		const handler = middy((event) => event).use(
			eventLogger({ logger, omitPaths }),
		);
		await handler({ foo: "foo", bar: "bar" }, defaultContext);

		deepStrictEqual(omitPaths, original);
	});

	test("eventLoggerValidateOptions accepts valid options and rejects typos", () => {
		eventLoggerValidateOptions({
			logger: () => {},
			omitPaths: ["event.a.b"],
			mask: "***",
		});
		eventLoggerValidateOptions({});
		try {
			eventLoggerValidateOptions({ omitPath: ["a"] });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/event-logger");
		}
	});

	test("eventLoggerValidateOptions caps mask at 1024 printable characters", () => {
		eventLoggerValidateOptions({ mask: "***omitted***" });
		eventLoggerValidateOptions({ mask: "x".repeat(1024) });
		throws(() => eventLoggerValidateOptions({ mask: "x".repeat(1025) }), {
			name: "TypeError",
			message: "Option 'mask' must have length <= 1024",
			cause: { package: "@middy/event-logger" },
		});
		throws(() => eventLoggerValidateOptions({ mask: "line\nbreak" }), {
			name: "TypeError",
			message: /^Option 'mask' must match pattern /,
			cause: { package: "@middy/event-logger" },
		});
	});

	test("It should omit an array path whose segment holds a dot", async (t) => {
		const logger = t.mock.fn();
		const omitPaths = [
			["event", "CodePipeline.job", "data", "artifactCredentials"],
		];
		eventLoggerValidateOptions({ omitPaths });

		const handler = middy((event) => event).use(
			eventLogger({ logger, omitPaths }),
		);

		await handler(
			{
				"CodePipeline.job": {
					id: "1",
					data: { artifactCredentials: { secretAccessKey: "SECRET" } },
				},
			},
			defaultContext,
		);

		deepStrictEqual(logger.mock.calls[0].arguments[0].event, {
			"CodePipeline.job": { id: "1", data: {} },
		});
	});

	test("eventLoggerValidateOptions rejects an omitPaths entry that is not a string or an array of strings", () => {
		for (const entry of [1, null, {}, ["event", 1], [["event"]], []]) {
			throws(() => eventLoggerValidateOptions({ omitPaths: [entry] }), {
				name: "TypeError",
				message: "Option 'omitPaths[0]' must match exactly one schema in oneOf",
				cause: { package: "@middy/event-logger" },
			});
		}
	});

	test("eventLoggerValidateOptions rejects a path that could never match", () => {
		for (const path of [
			"event.Records[].body",
			"event.Records.0.body",
			"event.Records.*.body",
			["event", "Records", "__proto__"],
		]) {
			const invalidPath = { name: "TypeError", message: /^Invalid path / };
			throws(
				() => eventLoggerValidateOptions({ omitPaths: [path] }),
				invalidPath,
			);
			throws(() => eventLogger({ omitPaths: [path] }), invalidPath);
		}
		eventLoggerValidateOptions({
			omitPaths: ["event.Records.[].body", ["event", "Records", "[]", "0"]],
		});
	});

	test("eventLoggerValidateOptions rejects wrong types", () => {
		try {
			eventLoggerValidateOptions({ logger: "not-a-fn" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("logger"));
		}
		try {
			eventLoggerValidateOptions({ omitPaths: "event.a" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("omitPaths"));
		}
		try {
			eventLoggerValidateOptions({ mask: 1 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("mask"));
		}
	});
});
