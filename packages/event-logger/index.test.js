import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import eventLogger, { eventLoggerValidateOptions } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

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

test("It should return no-op middleware when logger is false", async (t) => {
	const middleware = eventLogger({ logger: false });
	strictEqual(middleware.before, undefined);
	strictEqual(middleware.after, undefined);
	strictEqual(middleware.onError, undefined);
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

test("eventLoggerValidateOptions accepts logger:false and rejects logger:true", () => {
	eventLoggerValidateOptions({ logger: false });
	try {
		eventLoggerValidateOptions({ logger: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("logger"));
	}
});
