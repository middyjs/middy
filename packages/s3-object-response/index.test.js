import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import { clearCache } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";

import s3ObjectResponse, { s3ObjectResponseValidateOptions } from "./index.js";

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

const awsOrigin = "https://s3.amazonservices.com";
const defaultEvent = {
	getObjectContext: {
		inputS3Url: `${awsOrigin}/key?signature`,
		outputRoute: `${awsOrigin}/key`,
		outputToken: "token",
	},
};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should fetch and forward Body", async (t) => {
	const s3Data = JSON.stringify({ key: "item", value: 1 });
	t.mock.method(globalThis, "fetch", async () => {
		return new Response(s3Data, {
			status: 200,
			headers: { "Content-Type": "application/json; charset=UTF-8" },
		});
	});

	mockClient(S3Client)
		.on(WriteGetObjectResponseCommand, {
			RequestRoute: defaultEvent.outputRoute,
			RequestToken: defaultEvent.outputToken,
			Body: s3Data,
		})
		.resolvesOnce({ statusCode: 200 });

	const handler = middy(async (event, context) => {
		ok(typeof context.s3ObjectFetch.then === "function");
		const res = await context.s3ObjectFetch;
		return {
			Body: await res.text(),
		};
	});

	handler.use(
		s3ObjectResponse({
			AwsClient: S3Client,
		}),
	);

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(200, response.statusCode);
});

test("It should fetch and forward body", async (t) => {
	const s3Data = JSON.stringify({ key: "item", value: 1 });
	t.mock.method(globalThis, "fetch", async () => {
		return new Response(s3Data, {
			status: 200,
			headers: { "Content-Type": "application/json; charset=UTF-8" },
		});
	});
	mockClient(S3Client)
		.on(WriteGetObjectResponseCommand, {
			RequestRoute: defaultEvent.outputRoute,
			RequestToken: defaultEvent.outputToken,
			Body: s3Data,
		})
		.resolvesOnce({ statusCode: 200 });

	const handler = middy(async (event, context) => {
		ok(typeof context.s3ObjectFetch.then === "function");
		const res = await context.s3ObjectFetch;
		return {
			body: await res.text(),
		};
	});

	handler.use(
		s3ObjectResponse({
			AwsClient: S3Client,
		}),
	);

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(200, response.statusCode);
});

test("It should fetch and forward Body w/ {disablePrefetch:true}", async (t) => {
	const s3Data = JSON.stringify({ key: "item", value: 1 });
	t.mock.method(globalThis, "fetch", async () => {
		return new Response(s3Data, {
			status: 200,
			headers: { "Content-Type": "application/json; charset=UTF-8" },
		});
	});
	mockClient(S3Client)
		.on(WriteGetObjectResponseCommand, {
			RequestRoute: defaultEvent.outputRoute,
			RequestToken: defaultEvent.outputToken,
			Body: s3Data,
		})
		.resolvesOnce({ statusCode: 200 });

	const handler = middy(async (event, context) => {
		ok(typeof context.s3ObjectFetch.then === "function");
		const res = await context.s3ObjectFetch;
		return {
			Body: await res.text(),
		};
	});

	handler.use(
		s3ObjectResponse({
			AwsClient: S3Client,
			disablePrefetch: true,
		}),
	);

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(200, response.statusCode);
});

test("It should not throw when handler returns undefined", async (t) => {
	t.mock.method(globalThis, "fetch", async () => new Response(""));
	mockClient(S3Client)
		.on(WriteGetObjectResponseCommand)
		.resolvesOnce({ statusCode: 200 });

	const handler = middy(async (event, context) => {
		await context.s3ObjectFetch;
		// handler returns nothing
	});

	handler.use(
		s3ObjectResponse({
			AwsClient: S3Client,
		}),
	);

	const response = await handler(defaultEvent, defaultContext);
	strictEqual(response.statusCode, 200);
});

test("It should not emit unhandledRejection when prefetch fetch rejects and handler ignores it", async (t) => {
	t.mock.method(globalThis, "fetch", async () => {
		throw new Error("fetch failed");
	});
	mockClient(S3Client)
		.on(WriteGetObjectResponseCommand)
		.resolvesOnce({ statusCode: 200 });

	const unhandled = [];
	const onUnhandled = (reason) => unhandled.push(reason);
	process.on("unhandledRejection", onUnhandled);

	// Handler never awaits context.s3ObjectFetch, so its rejection must be
	// swallowed by an internal .catch to avoid an unhandledRejection.
	const handler = middy(async (event, context) => {
		return { Body: "ok" };
	});

	handler.use(
		s3ObjectResponse({
			AwsClient: S3Client,
		}),
	);

	const response = await handler(defaultEvent, defaultContext);
	// Allow any microtask-queued rejection to surface.
	await new Promise((resolve) => setImmediate(resolve));
	process.off("unhandledRejection", onUnhandled);

	strictEqual(response.statusCode, 200);
	deepStrictEqual(unhandled, []);
});

test("It should surface the real fetch error to a consumer that awaits context.s3ObjectFetch", async (t) => {
	t.mock.method(globalThis, "fetch", async () => {
		throw new Error("fetch failed");
	});
	mockClient(S3Client)
		.on(WriteGetObjectResponseCommand)
		.resolvesOnce({ statusCode: 200 });

	// A consumer that awaits the prefetched value must see the real error, not a
	// swallowed `undefined`.
	const handler = middy(async (event, context) => {
		await context.s3ObjectFetch;
	});

	handler.use(
		s3ObjectResponse({
			AwsClient: S3Client,
		}),
	);

	await rejects(() => handler(defaultEvent, defaultContext), /fetch failed/);
});

test("It should export s3ObjectResponseParam helper for TypeScript type inference", async (t) => {
	const { s3ObjectResponseParam } = await import("./index.js");
	const paramName = "test-param";
	const result = s3ObjectResponseParam(paramName);
	strictEqual(result, paramName);
});

test("It should handle event without getObjectContext", async (t) => {
	const responseBody = "test response";
	mockClient(S3Client)
		.on(WriteGetObjectResponseCommand)
		.resolvesOnce({ statusCode: 200 });

	const handler = middy(async (event, context) => {
		strictEqual(context.s3ObjectFetch, undefined);
		return {
			Body: responseBody,
		};
	});

	handler.use(
		s3ObjectResponse({
			AwsClient: S3Client,
		}),
	);

	const event = {};
	const response = await handler(event, defaultContext);
	strictEqual(response.statusCode, 200);
});

test("It should handle event with getObjectContext but no inputS3Url", async (t) => {
	const responseBody = "test response";
	mockClient(S3Client)
		.on(WriteGetObjectResponseCommand)
		.resolvesOnce({ statusCode: 200 });

	const handler = middy(async (event, context) => {
		strictEqual(context.s3ObjectFetch, undefined);
		return {
			Body: responseBody,
		};
	});

	handler.use(
		s3ObjectResponse({
			AwsClient: S3Client,
		}),
	);

	const event = {
		getObjectContext: {
			outputRoute: `${awsOrigin}/key`,
			outputToken: "token",
		},
	};
	const response = await handler(event, defaultContext);
	strictEqual(response.statusCode, 200);
});

test("It should handle non-InvalidSignatureException error from S3", async (t) => {
	t.mock.method(globalThis, "fetch", async () => new Response(""));
	const s3Data = "test";
	const error = new Error("SomeOtherError");

	mockClient(S3Client).on(WriteGetObjectResponseCommand).rejects(error);

	const handler = middy(async (event, context) => {
		return { Body: s3Data };
	});

	handler.use(
		s3ObjectResponse({
			AwsClient: S3Client,
		}),
	);

	try {
		await handler(defaultEvent, defaultContext);
		throw new Error("Expected error");
	} catch (e) {
		strictEqual(e.message, "SomeOtherError");
	}
});

test("It should handle InvalidSignatureException and retry", async (t) => {
	t.mock.method(globalThis, "fetch", async () => new Response(""));
	const s3Data = JSON.stringify({ key: "item", value: 1 });
	const invalidSignatureError = new Error("InvalidSignatureException");
	invalidSignatureError.__type = "InvalidSignatureException";

	mockClient(S3Client)
		.on(WriteGetObjectResponseCommand, {
			RequestRoute: defaultEvent.outputRoute,
			RequestToken: defaultEvent.outputToken,
			Body: s3Data,
		})
		.rejectsOnce(invalidSignatureError)
		.resolvesOnce({ statusCode: 200 });

	const handler = middy(async (event, context) => {
		return {
			Body: s3Data,
		};
	});

	handler.use(
		s3ObjectResponse({
			AwsClient: S3Client,
		}),
	);

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(response.statusCode, 200);
});

test("s3ObjectResponseValidateOptions accepts valid options and rejects typos", () => {
	s3ObjectResponseValidateOptions({ AwsClient: S3Client });
	s3ObjectResponseValidateOptions({});
	try {
		s3ObjectResponseValidateOptions({ disablePrefech: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/s3-object-response");
	}
});

test("s3ObjectResponseValidateOptions rejects wrong type", () => {
	try {
		s3ObjectResponseValidateOptions({ disablePrefetch: "nope" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("disablePrefetch"));
		// Must reject specifically because the value is not a boolean (not because
		// the schema rule itself was dropped/malformed).
		ok(e.message.includes("boolean"));
	}
});

test("s3ObjectResponseValidateOptions accepts a boolean disablePrefetch", () => {
	// A valid boolean must pass. A dropped/empty disablePrefetch rule would throw
	// a schema error for every value, including valid booleans.
	s3ObjectResponseValidateOptions({ disablePrefetch: true });
	s3ObjectResponseValidateOptions({ disablePrefetch: false });
});

test("s3ObjectResponseValidateOptions rejects non-object awsClientOptions", () => {
	try {
		s3ObjectResponseValidateOptions({ awsClientOptions: "nope" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("awsClientOptions"));
	}
});

test("s3ObjectResponseValidateOptions rejects non-string awsClientAssumeRole", () => {
	try {
		s3ObjectResponseValidateOptions({ awsClientAssumeRole: 123 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("awsClientAssumeRole"));
	}
});

test("s3ObjectResponseValidateOptions accepts string awsClientAssumeRole", () => {
	s3ObjectResponseValidateOptions({ awsClientAssumeRole: "role" });
});

test("s3ObjectResponseValidateOptions rejects non-function awsClientCapture", () => {
	try {
		s3ObjectResponseValidateOptions({ awsClientCapture: {} });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("awsClientCapture"));
	}
});

test("s3ObjectResponseValidateOptions accepts function awsClientCapture", () => {
	s3ObjectResponseValidateOptions({ awsClientCapture: (client) => client });
});

test("s3ObjectResponseValidateOptions accepts object awsClientOptions", () => {
	s3ObjectResponseValidateOptions({
		awsClientOptions: { region: "us-east-1" },
	});
});

test("It should create a prefetch client at construction time by default", async (t) => {
	let constructed = 0;
	class AwsClient {
		constructor() {
			constructed += 1;
		}
		send() {
			return Promise.resolve({ statusCode: 200 });
		}
	}

	// No disablePrefetch / awsClientAssumeRole passed: defaults make canPrefetch
	// true, so createPrefetchClient runs immediately at construction, before any
	// handler call.
	s3ObjectResponse({ AwsClient });

	strictEqual(constructed, 1);
});

test("It should NOT create a client at construction when disablePrefetch is true", async (t) => {
	let constructed = 0;
	class AwsClient {
		constructor() {
			constructed += 1;
		}
		send() {
			return Promise.resolve({ statusCode: 200 });
		}
	}

	s3ObjectResponse({ AwsClient, disablePrefetch: true });

	strictEqual(constructed, 0);
});

test("It should reuse the prefetched client in after (no second construction)", async (t) => {
	t.mock.method(globalThis, "fetch", async () => new Response("body-data"));
	let constructed = 0;
	const sendArgs = [];
	class AwsClient {
		constructor() {
			constructed += 1;
		}
		send(command) {
			sendArgs.push(command);
			return Promise.resolve({ statusCode: 200 });
		}
	}

	const handler = middy(async () => ({ Body: "body-data" }));
	handler.use(s3ObjectResponse({ AwsClient }));

	strictEqual(constructed, 1);
	const response = await handler(defaultEvent, defaultContext);
	strictEqual(response.statusCode, 200);
	// The prefetched client must be reused: createClient (which constructs a new
	// client) must not run again in the after hook.
	strictEqual(constructed, 1);
	strictEqual(sendArgs.length, 1);
});

test("It should lazily create the client in after when prefetch is disabled", async (t) => {
	t.mock.method(globalThis, "fetch", async () => new Response("body-data"));
	let constructed = 0;
	class AwsClient {
		constructor() {
			constructed += 1;
		}
		send() {
			return Promise.resolve({ statusCode: 200 });
		}
	}

	const handler = middy(async () => ({ Body: "body-data" }));
	handler.use(s3ObjectResponse({ AwsClient, disablePrefetch: true }));

	strictEqual(constructed, 0);
	const response = await handler(defaultEvent, defaultContext);
	strictEqual(response.statusCode, 200);
	strictEqual(constructed, 1);
});

test("It should use the default S3Client AwsClient when AwsClient is omitted", async (t) => {
	// With defaults applied, omitting AwsClient must fall back to S3Client. If the
	// defaults object were empty, AwsClient would be undefined and construction
	// would throw.
	const middleware = s3ObjectResponse({});
	ok(typeof middleware.before === "function");
	ok(typeof middleware.after === "function");
});

test("It should build the command with RequestRoute, RequestToken and Body", async (t) => {
	t.mock.method(globalThis, "fetch", async () => new Response("ignored"));
	let captured;
	class AwsClient {
		send(command) {
			captured = command;
			return Promise.resolve({ statusCode: 200 });
		}
	}

	const handler = middy(async () => ({ Body: "the-body" }));
	handler.use(s3ObjectResponse({ AwsClient }));

	await handler(defaultEvent, defaultContext);

	ok(captured instanceof WriteGetObjectResponseCommand);
	strictEqual(
		captured.input.RequestRoute,
		defaultEvent.getObjectContext.outputRoute,
	);
	strictEqual(
		captured.input.RequestToken,
		defaultEvent.getObjectContext.outputToken,
	);
	strictEqual(captured.input.Body, "the-body");
});

test("It should fall back to request.response.body when Body is absent", async (t) => {
	t.mock.method(globalThis, "fetch", async () => new Response("ignored"));
	let captured;
	class AwsClient {
		send(command) {
			captured = command;
			return Promise.resolve({ statusCode: 200 });
		}
	}

	const handler = middy(async () => ({ body: "lowercase-body" }));
	handler.use(s3ObjectResponse({ AwsClient }));

	await handler(defaultEvent, defaultContext);

	strictEqual(captured.input.Body, "lowercase-body");
});
