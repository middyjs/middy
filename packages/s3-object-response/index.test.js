import {
	deepStrictEqual,
	ok,
	rejects,
	strictEqual,
	throws,
} from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, test } from "node:test";
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import middy from "@middy/core";
import { clearCache, HttpError } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";

import s3ObjectResponse, { s3ObjectResponseValidateOptions } from "./index.js";

describe("@middy/s3-object-response", () => {
	test.afterEach((t) => {
		t.mock.reset();
		clearCache();
	});

	// Host shape of the presigned inputS3Url S3 Object Lambda hands the function.
	const awsOrigin =
		"https://my-s3-ap-111122223333.s3-accesspoint.us-east-1.amazonaws.com";
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
				RequestRoute: defaultEvent.getObjectContext.outputRoute,
				RequestToken: defaultEvent.getObjectContext.outputToken,
				Body: s3Data,
			})
			.resolvesOnce({ statusCode: 200 });

		const handler = middy(async (event, context) => {
			ok(typeof context.middyContext["s3-object-response"].then === "function");
			const res = await context.middyContext["s3-object-response"];
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
				RequestRoute: defaultEvent.getObjectContext.outputRoute,
				RequestToken: defaultEvent.getObjectContext.outputToken,
				Body: s3Data,
			})
			.resolvesOnce({ statusCode: 200 });

		const handler = middy(async (event, context) => {
			ok(typeof context.middyContext["s3-object-response"].then === "function");
			const res = await context.middyContext["s3-object-response"];
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
				RequestRoute: defaultEvent.getObjectContext.outputRoute,
				RequestToken: defaultEvent.getObjectContext.outputToken,
				Body: s3Data,
			})
			.resolvesOnce({ statusCode: 200 });

		const handler = middy(async (event, context) => {
			ok(typeof context.middyContext["s3-object-response"].then === "function");
			const res = await context.middyContext["s3-object-response"];
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
			await context.middyContext["s3-object-response"];
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

	// A presigned GET that hangs would hold the invocation until Lambda cuts it
	// off; it is aborted 500 ms early, with a 30 s budget outside Lambda and a
	// 1 s floor.
	for (const [remaining, expected] of [
		[5000, 4500],
		[undefined, 29500],
		[100, 1000],
	]) {
		test(`It should abort the input fetch after ${expected} ms`, async (t) => {
			const fetchMock = t.mock.method(
				globalThis,
				"fetch",
				async () => new Response(""),
			);
			const timeout = t.mock.method(AbortSignal, "timeout");
			mockClient(S3Client)
				.on(WriteGetObjectResponseCommand)
				.resolvesOnce({ statusCode: 200 });

			const handler = middy(async (event, context) => {
				await context.middyContext["s3-object-response"];
			});
			handler.use(s3ObjectResponse({ AwsClient: S3Client }));

			await handler(
				defaultEvent,
				remaining === undefined
					? {}
					: { getRemainingTimeInMillis: () => remaining },
			);
			strictEqual(timeout.mock.calls[0].arguments[0], expected);
			ok(fetchMock.mock.calls[0].arguments[1].signal instanceof AbortSignal);
		});
	}

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

		// Handler never awaits the fetch promise, so its rejection must be
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

	test("It should surface the real fetch error to a consumer that awaits the fetch promise", async (t) => {
		t.mock.method(globalThis, "fetch", async () => {
			throw new Error("fetch failed");
		});
		mockClient(S3Client)
			.on(WriteGetObjectResponseCommand)
			.resolvesOnce({ statusCode: 200 });

		// A consumer that awaits the prefetched value must see the real error, not a
		// swallowed `undefined`.
		const handler = middy(async (event, context) => {
			await context.middyContext["s3-object-response"];
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

	for (const contextName of [
		"headObjectContext",
		"listObjectsContext",
		"listObjectsV2Context",
	]) {
		test(`It should return the handler's JSON without WriteGetObjectResponse for a ${contextName} event`, async (t) => {
			const mockService = mockClient(S3Client);
			const json = { statusCode: 200, headers: { "Content-Length": 11 } };

			const handler = middy(async (event, context) => {
				strictEqual(context.middyContext["s3-object-response"], undefined);
				return json;
			});
			handler.use(s3ObjectResponse({ AwsClient: S3Client }));

			const event = {
				[contextName]: { inputS3Url: `${awsOrigin}/key?signature` },
			};
			const response = await handler(event, defaultContext);
			strictEqual(response, json);
			strictEqual(
				mockService.commandCalls(WriteGetObjectResponseCommand).length,
				0,
			);
		});
	}

	const errorEvent = {
		getObjectContext: { outputRoute: "route", outputToken: "token" },
	};
	const mockWriteGetObjectResponse = () => {
		const mockService = mockClient(S3Client);
		mockService.on(WriteGetObjectResponseCommand).resolves({});
		return () =>
			mockService
				.commandCalls(WriteGetObjectResponseCommand)
				.map((call) => call.args[0].input);
	};

	test("It should write an http error thrown by the handler through WriteGetObjectResponse", async (t) => {
		const writes = mockWriteGetObjectResponse();
		const error = new HttpError(403);
		const handler = middy(async () => {
			throw error;
		}).use(s3ObjectResponse({ AwsClient: S3Client }));

		await rejects(
			() => handler(errorEvent, defaultContext),
			(e) => e === error,
		);
		deepStrictEqual(writes(), [
			{
				RequestRoute: "route",
				RequestToken: "token",
				StatusCode: 403,
				ErrorCode: "ForbiddenError",
				ErrorMessage: "Forbidden",
			},
		]);
	});

	const internalServerError = {
		RequestRoute: "route",
		RequestToken: "token",
		StatusCode: 500,
		ErrorCode: "InternalServerError",
		ErrorMessage: "Internal Server Error",
	};
	for (const [label, thrown] of [
		["a plain Error", new Error("secret detail")],
		[
			"an Error with a bare statusCode",
			Object.assign(new Error("Forbidden"), { statusCode: 403 }),
		],
		["an http error that is not exposed", new HttpError(503)],
		["null", null],
	]) {
		test(`It should write a 500 through WriteGetObjectResponse when the handler throws ${label}`, async (t) => {
			const writes = mockWriteGetObjectResponse();
			const handler = middy(async () => {
				throw thrown;
			}).use(s3ObjectResponse({ AwsClient: S3Client }));

			await rejects(
				() => handler(errorEvent, defaultContext),
				(e) => e === thrown,
			);
			deepStrictEqual(writes(), [internalServerError]);
		});
	}

	test("It should write a 500 for an exposed http error whose status WriteGetObjectResponse does not list", async (t) => {
		const writes = mockWriteGetObjectResponse();
		const handler = middy(async () => {
			throw new HttpError(422);
		}).use(s3ObjectResponse({ AwsClient: S3Client }));

		await rejects(() => handler(errorEvent, defaultContext), {
			statusCode: 422,
		});
		deepStrictEqual(writes(), [internalServerError]);
	});

	for (const statusCode of [
		400, 401, 403, 404, 405, 409, 411, 412, 416, 500, 503,
	]) {
		test(`It should write an exposed ${statusCode} with its own status, name and message`, async (t) => {
			const writes = mockWriteGetObjectResponse();
			const error = new HttpError(statusCode, { expose: true });
			const handler = middy(async () => {
				throw error;
			}).use(s3ObjectResponse({ AwsClient: S3Client }));

			await rejects(
				() => handler(errorEvent, defaultContext),
				(e) => e === error,
			);
			deepStrictEqual(writes(), [
				{
					RequestRoute: "route",
					RequestToken: "token",
					StatusCode: statusCode,
					ErrorCode: error.name,
					ErrorMessage: error.message,
				},
			]);
		});
	}

	for (const name of ["forbiddenError", "Forbidden_Error"]) {
		test(`It should write a 500 for an exposed http error named ${name}`, async (t) => {
			const writes = mockWriteGetObjectResponse();
			const error = Object.assign(new HttpError(403), { name });
			const handler = middy(async () => {
				throw error;
			}).use(s3ObjectResponse({ AwsClient: S3Client }));

			await rejects(
				() => handler(errorEvent, defaultContext),
				(e) => e === error,
			);
			deepStrictEqual(writes(), [internalServerError]);
		});
	}

	test("It should not write an error after the response itself failed to send", async (t) => {
		const mockService = mockClient(S3Client);
		const error = new Error("write failed");
		mockService
			.on(WriteGetObjectResponseCommand)
			.rejectsOnce(error)
			.resolves({});
		const handler = middy(async () => ({ Body: "object" })).use(
			s3ObjectResponse({ AwsClient: S3Client }),
		);

		await rejects(
			() => handler(errorEvent, defaultContext),
			(e) => e === error,
		);
		strictEqual(
			mockService.commandCalls(WriteGetObjectResponseCommand).length,
			1,
		);
	});

	test("It should not write an error for an event without getObjectContext", async (t) => {
		const writes = mockWriteGetObjectResponse();
		const error = new HttpError(403);
		const handler = middy(async () => {
			throw error;
		}).use(s3ObjectResponse({ AwsClient: S3Client }));

		await rejects(
			() =>
				handler(
					{ headObjectContext: { inputS3Url: `${awsOrigin}/key?signature` } },
					defaultContext,
				),
			(e) => e === error,
		);
		deepStrictEqual(writes(), []);
	});

	test("It should write its own 400 for a disallowed inputS3Url through WriteGetObjectResponse", async (t) => {
		const writes = mockWriteGetObjectResponse();
		const handler = middy(async () => ({ Body: "object" })).use(
			s3ObjectResponse({ AwsClient: S3Client }),
		);

		await rejects(
			() =>
				handler(
					{
						getObjectContext: {
							...errorEvent.getObjectContext,
							inputS3Url: "https://evil.example/key?signature",
						},
					},
					defaultContext,
				),
			{ statusCode: 400 },
		);
		deepStrictEqual(writes(), [
			{
				RequestRoute: "route",
				RequestToken: "token",
				StatusCode: 400,
				ErrorCode: "BadRequestError",
				ErrorMessage: "Bad Request",
			},
		]);
	});

	test("It should URL encode an error message that has consecutive spaces", async (t) => {
		const writes = mockWriteGetObjectResponse();
		const error = Object.assign(new HttpError(404), {
			message: "my  file.txt",
		});
		const handler = middy(async () => {
			throw error;
		}).use(s3ObjectResponse({ AwsClient: S3Client }));

		await rejects(
			() => handler(errorEvent, defaultContext),
			(e) => e === error,
		);
		strictEqual(writes()[0].ErrorMessage, "my%20%20file.txt");
	});

	test("It should write an exposed error that has no message without an ErrorMessage", async (t) => {
		const writes = mockWriteGetObjectResponse();
		const error = { expose: true, statusCode: 403, name: "Forbidden" };
		const handler = middy(async () => {
			throw error;
		}).use(s3ObjectResponse({ AwsClient: S3Client }));

		await rejects(
			() => handler(errorEvent, defaultContext),
			(e) => e === error,
		);
		const [write] = writes();
		strictEqual(write.StatusCode, 403);
		strictEqual(write.ErrorCode, "Forbidden");
		strictEqual(write.ErrorMessage, undefined);
	});

	test("It should handle event with getObjectContext but no inputS3Url", async (t) => {
		const responseBody = "test response";
		mockClient(S3Client)
			.on(WriteGetObjectResponseCommand)
			.resolvesOnce({ statusCode: 200 });

		const handler = middy(async (event, context) => {
			strictEqual(context.middyContext["s3-object-response"], undefined);
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
				RequestRoute: defaultEvent.getObjectContext.outputRoute,
				RequestToken: defaultEvent.getObjectContext.outputToken,
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

	test("s3ObjectResponseValidateOptions validates contextKey as a string", () => {
		// Pins the rule itself: an empty `{}` rule would accept the number below,
		// and a blank `type` would reject the valid string above.
		s3ObjectResponseValidateOptions({ contextKey: "custom" });
		try {
			s3ObjectResponseValidateOptions({ contextKey: 123 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("contextKey"));
		}
	});

	test("It should retry client init after a rejected attempt", async (t) => {
		t.mock.method(globalThis, "fetch", async () => new Response("body-data"));
		let constructed = 0;
		class AwsClient {
			constructor() {
				constructed += 1;
				if (constructed === 1) throw new Error("init boom");
			}
			send() {
				return Promise.resolve({ statusCode: 200 });
			}
		}

		const handler = middy(async () => ({ Body: "body-data" }));
		handler.use(s3ObjectResponse({ AwsClient, disablePrefetch: true }));

		// A rejected init must not be memoized for the life of the container.
		await rejects(() => handler(defaultEvent, defaultContext), /init boom/);
		const response = await handler(defaultEvent, defaultContext);
		strictEqual(response.statusCode, 200);
		strictEqual(constructed, 2);
	});

	const fetchSpy = (t) => {
		const calls = [];
		t.mock.method(globalThis, "fetch", async (url) => {
			calls.push(url);
			return new Response("original");
		});
		return calls;
	};

	const eventWithInputUrl = (inputS3Url) => ({
		getObjectContext: {
			inputS3Url,
			outputRoute: "route",
			outputToken: "token",
		},
	});

	const expectRejectedInputUrl = async (t, inputS3Url, opts = {}) => {
		const calls = fetchSpy(t);
		class AwsClient {
			send() {
				return Promise.resolve({ statusCode: 200 });
			}
		}
		const handler = middy(async () => ({ Body: "b" })).use(
			s3ObjectResponse({ AwsClient, ...opts }),
		);
		try {
			await handler(eventWithInputUrl(inputS3Url), defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 400);
			strictEqual(e.cause.package, "@middy/s3-object-response");
			// The presigned query string carries credentials, so only the host is
			// reported.
			ok(!JSON.stringify(e.cause.data).includes("signature"));
			const parsed = URL.parse(inputS3Url);
			const { reason, hostname, port, allowedHosts } = e.cause.data;
			strictEqual(
				reason,
				"inputS3Url must be an https URL without a port on an allowed host",
			);
			strictEqual(hostname, parsed?.hostname);
			strictEqual(port, parsed?.port);
			if (opts.allowedHosts) deepStrictEqual(allowedHosts, opts.allowedHosts);
			else ok(allowedHosts.includes("*.s3-accesspoint.*.amazonaws.com"));
		}
		// Nothing is fetched from a host that failed the allowlist.
		deepStrictEqual(calls, []);
	};

	const expectAcceptedInputUrl = async (t, inputS3Url, opts = {}) => {
		const calls = fetchSpy(t);
		class AwsClient {
			send() {
				return Promise.resolve({ statusCode: 200 });
			}
		}
		const handler = middy(async (event, context) => {
			const res = await context.middyContext["s3-object-response"];
			return { Body: await res.text() };
		}).use(s3ObjectResponse({ AwsClient, ...opts }));
		const response = await handler(
			eventWithInputUrl(inputS3Url),
			defaultContext,
		);
		strictEqual(response.statusCode, 200);
		deepStrictEqual(calls, [inputS3Url]);
	};

	for (const contextName of [
		"headObjectContext",
		"listObjectsContext",
		"listObjectsV2Context",
	]) {
		test(`It should reject a ${contextName}.inputS3Url on a host outside allowedHosts before the handler runs`, async (t) => {
			const calls = fetchSpy(t);
			mockClient(S3Client);
			let handled = false;
			const handler = middy(async () => {
				handled = true;
				return { statusCode: 200 };
			}).use(s3ObjectResponse({ AwsClient: S3Client }));

			await rejects(
				() =>
					handler(
						{
							[contextName]: {
								inputS3Url: "https://evil.example/key?signature",
							},
						},
						defaultContext,
					),
				(e) =>
					e.statusCode === 400 &&
					e.cause.package === "@middy/s3-object-response" &&
					e.cause.data.hostname === "evil.example",
			);
			strictEqual(handled, false);
			deepStrictEqual(calls, []);
		});
	}

	test("It should reject an http inputS3Url without fetching it", async (t) => {
		await expectRejectedInputUrl(
			t,
			"http://bucket.s3-accesspoint.us-east-1.amazonaws.com/key?signature",
		);
	});

	test("It should reject an inputS3Url on a host outside allowedHosts", async (t) => {
		await expectRejectedInputUrl(t, "https://evil.example/key?signature");
	});

	test("It should reject a host that only ends with the allowed text", async (t) => {
		await expectRejectedInputUrl(t, "https://evilamazonaws.com/key?signature");
	});

	test("It should reject an inputS3Url that is not a URL", async (t) => {
		await expectRejectedInputUrl(t, "not a url");
	});

	test("It should accept hosts listed in allowedHosts, with or without a subdomain", async (t) => {
		await expectAcceptedInputUrl(t, "https://minio.internal/bucket/key", {
			allowedHosts: ["minio.internal"],
		});
		await expectAcceptedInputUrl(t, "https://s3.minio.internal/bucket/key", {
			allowedHosts: [".minio.internal"],
		});
	});

	test("It should not accept the default host once allowedHosts overrides it", async (t) => {
		await expectRejectedInputUrl(t, `${awsOrigin}/key?signature`, {
			allowedHosts: ["minio.internal"],
		});
	});

	test("s3ObjectResponseValidateOptions validates allowedHosts as an array of strings", () => {
		s3ObjectResponseValidateOptions({ allowedHosts: [".amazonaws.com"] });
		try {
			s3ObjectResponseValidateOptions({ allowedHosts: ".amazonaws.com" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("allowedHosts"));
		}
		try {
			s3ObjectResponseValidateOptions({ allowedHosts: [1] });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("allowedHosts"));
		}
	});

	const rejectsOptions = (options, message) => {
		throws(() => s3ObjectResponseValidateOptions(options), {
			name: "TypeError",
			message,
			cause: { package: "@middy/s3-object-response" },
		});
	};

	test("s3ObjectResponseValidateOptions accepts the documented allowedHosts shapes", () => {
		const options = {
			allowedHosts: [
				"*.s3-accesspoint.*.amazonaws.com",
				".amazonaws.com",
				"MinIO.Internal",
				"bücher.example",
				"xn--bcher-kva.example",
				"h".repeat(255),
			],
		};
		deepStrictEqual(s3ObjectResponseValidateOptions(options), options);
		const many = {
			allowedHosts: Array.from({ length: 1024 }, (_, i) => `h${i}`),
		};
		deepStrictEqual(s3ObjectResponseValidateOptions(many), many);
	});

	test("s3ObjectResponseValidateOptions rejects allowedHosts that are not hostnames", () => {
		for (const [allowedHosts, message] of [
			[
				["a b"],
				"Option 'allowedHosts[0]' must match pattern /^[\\p{L}\\p{M}\\p{N}_*.-]+$/u",
			],
			[
				["minio.internal:9000"],
				"Option 'allowedHosts[0]' must match pattern /^[\\p{L}\\p{M}\\p{N}_*.-]+$/u",
			],
			[
				["minio.internal/bucket"],
				"Option 'allowedHosts[0]' must match pattern /^[\\p{L}\\p{M}\\p{N}_*.-]+$/u",
			],
			[
				["user@minio.internal"],
				"Option 'allowedHosts[0]' must match pattern /^[\\p{L}\\p{M}\\p{N}_*.-]+$/u",
			],
			[
				[""],
				"Option 'allowedHosts[0]' must match pattern /^[\\p{L}\\p{M}\\p{N}_*.-]+$/u",
			],
			[["h".repeat(256)], "Option 'allowedHosts[0]' must have length <= 255"],
			[["a.example", "a.example"], "Duplicate item at 'allowedHosts[1]'"],
			[
				Array.from({ length: 1025 }, (_, i) => `h${i}`),
				"Option 'allowedHosts' must have <= 1024 items",
			],
		]) {
			rejectsOptions({ allowedHosts }, message);
		}
	});

	test("s3ObjectResponseValidateOptions accepts the S3Client keys beyond the shared client config", () => {
		const fn = () => {};
		class Instance {}
		const awsClientOptions = {
			region: "us-east-1",
			bucketEndpoint: false,
			checksumAlgorithms: {
				CRC32: Instance,
				CRC32C: Instance,
				CRC64NVME: Instance,
				SHA1: Instance,
				SHA256: Instance,
			},
			clientContextParams: { disableS3ExpressSessionAuth: true },
			disableMultiregionAccessPoints: true,
			disableS3ExpressSessionAuth: false,
			eventStreamSerdeProvider: fn,
			expectContinueHeader: true,
			followRegionRedirects: true,
			forcePathStyle: true,
			getAwsChunkedEncodingStream: fn,
			md5: Instance,
			requestChecksumCalculation: "WHEN_REQUIRED",
			requestStreamBufferSize: 65536,
			responseChecksumValidation: "WHEN_SUPPORTED",
			s3ExpressIdentityProvider: new Instance(),
			sdkStreamMixin: fn,
			sha1: Instance,
			sigv4aSigningRegionSet: ["us-east-1", "*"],
			streamHasher: fn,
			useAccelerateEndpoint: false,
			useArnRegion: true,
			useGlobalEndpoint: false,
		};
		deepStrictEqual(s3ObjectResponseValidateOptions({ awsClientOptions }), {
			awsClientOptions,
		});
		for (const extra of [
			{ clientContextParams: { disableS3ExpressSessionAuth: fn } },
			{ clientContextParams: {} },
			{ disableS3ExpressSessionAuth: fn },
			{ expectContinueHeader: 0 },
			{ expectContinueHeader: Number.MAX_SAFE_INTEGER },
			{ requestChecksumCalculation: "WHEN_SUPPORTED" },
			{ requestChecksumCalculation: fn },
			{ requestStreamBufferSize: false },
			{ requestStreamBufferSize: 8192 },
			{ requestStreamBufferSize: Number.MAX_SAFE_INTEGER },
			{ responseChecksumValidation: "WHEN_REQUIRED" },
			{ responseChecksumValidation: fn },
			{ sigv4aSigningRegionSet: fn },
			{ sigv4aSigningRegionSet: ["a".repeat(63)] },
			{ useArnRegion: fn },
			{ useGlobalEndpoint: fn },
		]) {
			deepStrictEqual(
				s3ObjectResponseValidateOptions({ awsClientOptions: extra }),
				{
					awsClientOptions: extra,
				},
			);
		}
	});

	test("s3ObjectResponseValidateOptions rejects S3Client keys outside their SDK types", () => {
		const oneOf = (key) =>
			`Option 'awsClientOptions.${key}' must match exactly one schema in oneOf`;
		for (const [awsClientOptions, message] of [
			[{ maxRetries: 3 }, "Unknown option 'awsClientOptions.maxRetries'"],
			[
				{ checksumAlgorithms: { MD5: () => {} } },
				"Unknown option 'awsClientOptions.checksumAlgorithms.MD5'",
			],
			[
				{ clientContextParams: { forcePathStyle: true } },
				"Unknown option 'awsClientOptions.clientContextParams.forcePathStyle'",
			],
			[
				{ clientContextParams: { disableS3ExpressSessionAuth: "true" } },
				"Option 'awsClientOptions.clientContextParams.disableS3ExpressSessionAuth' must match exactly one schema in oneOf",
			],
			[
				{ s3ExpressIdentityProvider: "x" },
				"Option 'awsClientOptions.s3ExpressIdentityProvider' must be instanceof Object",
			],
			[{ expectContinueHeader: -1 }, oneOf("expectContinueHeader")],
			[{ expectContinueHeader: 1.5 }, oneOf("expectContinueHeader")],
			[{ expectContinueHeader: "true" }, oneOf("expectContinueHeader")],
			[
				{ requestChecksumCalculation: "ALWAYS" },
				oneOf("requestChecksumCalculation"),
			],
			[
				{ responseChecksumValidation: "ALWAYS" },
				oneOf("responseChecksumValidation"),
			],
			[{ requestStreamBufferSize: 8191 }, oneOf("requestStreamBufferSize")],
			[{ requestStreamBufferSize: true }, oneOf("requestStreamBufferSize")],
			[{ requestStreamBufferSize: 8192.5 }, oneOf("requestStreamBufferSize")],
			[
				{ sigv4aSigningRegionSet: ["us east"] },
				oneOf("sigv4aSigningRegionSet"),
			],
			[
				{ sigv4aSigningRegionSet: ["a".repeat(64)] },
				oneOf("sigv4aSigningRegionSet"),
			],
			[{ sigv4aSigningRegionSet: ["*", "*"] }, oneOf("sigv4aSigningRegionSet")],
			[{ sigv4aSigningRegionSet: "*" }, oneOf("sigv4aSigningRegionSet")],
			[
				{ disableS3ExpressSessionAuth: "true" },
				oneOf("disableS3ExpressSessionAuth"),
			],
			[{ useArnRegion: "true" }, oneOf("useArnRegion")],
			[{ useGlobalEndpoint: "true" }, oneOf("useGlobalEndpoint")],
		]) {
			rejectsOptions({ awsClientOptions }, message);
		}
		for (const key of [
			"bucketEndpoint",
			"disableMultiregionAccessPoints",
			"followRegionRedirects",
			"forcePathStyle",
			"useAccelerateEndpoint",
		]) {
			rejectsOptions(
				{ awsClientOptions: { [key]: "true" } },
				`Option 'awsClientOptions.${key}' must be boolean`,
			);
		}
		for (const key of [
			"eventStreamSerdeProvider",
			"getAwsChunkedEncodingStream",
			"md5",
			"sdkStreamMixin",
			"sha1",
			"streamHasher",
		]) {
			rejectsOptions(
				{ awsClientOptions: { [key]: "x" } },
				`Option 'awsClientOptions.${key}' must be instanceof Function`,
			);
		}
		for (const key of ["CRC32", "CRC32C", "CRC64NVME", "SHA1", "SHA256"]) {
			rejectsOptions(
				{ awsClientOptions: { checksumAlgorithms: { [key]: "x" } } },
				`Option 'awsClientOptions.checksumAlgorithms.${key}' must be instanceof Function`,
			);
		}
	});

	test("s3ObjectResponseValidateOptions bounds the string options", () => {
		for (const key of ["awsClientAssumeRole", "contextKey"]) {
			deepStrictEqual(
				s3ObjectResponseValidateOptions({ [key]: "k".repeat(1024) }),
				{ [key]: "k".repeat(1024) },
			);
			rejectsOptions(
				{ [key]: "k".repeat(1025) },
				`Option '${key}' must have length <= 1024`,
			);
			rejectsOptions(
				{ [key]: "a b" },
				`Option '${key}' must match pattern /^[\\x21-\\x7E]+$/u`,
			);
		}
	});

	test("It should forward the handler's WriteGetObjectResponse fields, taking route and token from the event", async (t) => {
		t.mock.method(globalThis, "fetch", async () => new Response("ignored"));
		let captured;
		class AwsClient {
			send(command) {
				captured = command;
				return Promise.resolve({ statusCode: 200 });
			}
		}

		const handler = middy(async () => ({
			Body: "the-body",
			ContentType: "text/plain",
			Metadata: { source: "middy" },
			StatusCode: 206,
			ContentEncoding: "gzip",
			// The event, not the handler, decides where the response is routed.
			RequestRoute: "handler-route",
			RequestToken: "handler-token",
		}));
		handler.use(s3ObjectResponse({ AwsClient }));

		await handler(defaultEvent, defaultContext);

		deepStrictEqual(captured.input, {
			RequestRoute: defaultEvent.getObjectContext.outputRoute,
			RequestToken: defaultEvent.getObjectContext.outputToken,
			Body: "the-body",
			ContentType: "text/plain",
			Metadata: { source: "middy" },
			StatusCode: 206,
			ContentEncoding: "gzip",
		});
	});

	test("It should not forward a lowercase body alias alongside Body", async (t) => {
		t.mock.method(globalThis, "fetch", async () => new Response("ignored"));
		let captured;
		class AwsClient {
			send(command) {
				captured = command;
				return Promise.resolve({ statusCode: 200 });
			}
		}

		const handler = middy(async () => ({ body: "lowercase", StatusCode: 200 }));
		handler.use(s3ObjectResponse({ AwsClient }));

		await handler(defaultEvent, defaultContext);

		deepStrictEqual(captured.input, {
			RequestRoute: defaultEvent.getObjectContext.outputRoute,
			RequestToken: defaultEvent.getObjectContext.outputToken,
			Body: "lowercase",
			StatusCode: 200,
		});
	});

	// ---------- default allowedHosts: supporting access point shapes only ----------

	test("It should reject other amazonaws.com hosts by default (EC2, S3 bucket, API Gateway, Object Lambda)", async (t) => {
		await expectRejectedInputUrl(
			t,
			"https://ec2-203-0-113-25.compute-1.amazonaws.com/key?signature",
		);
		await expectRejectedInputUrl(
			t,
			"https://bucket.s3.us-east-1.amazonaws.com/key?signature",
		);
		await expectRejectedInputUrl(
			t,
			"https://abc123.execute-api.us-east-1.amazonaws.com/prod/key?signature",
		);
		// Callers hit the Object Lambda endpoint; inputS3Url never points at it.
		await expectRejectedInputUrl(
			t,
			"https://bucket.s3-object-lambda.us-east-1.amazonaws.com/key?signature",
		);
	});

	test("It should reject access-point-like hosts with a missing or extra label", async (t) => {
		await expectRejectedInputUrl(
			t,
			"https://s3-accesspoint.us-east-1.amazonaws.com/key?signature",
		);
		await expectRejectedInputUrl(
			t,
			"https://a.b.s3-accesspoint.us-east-1.amazonaws.com/key?signature",
		);
		await expectRejectedInputUrl(
			t,
			"https://ap-111122223333.s3-accesspoint.us-east-1.amazonaws.com.evil.example/key?signature",
		);
	});

	test("It should not let * match an empty label", async (t) => {
		await expectRejectedInputUrl(
			t,
			"https://ap.s3-accesspoint..amazonaws.com/key?signature",
		);
		await expectRejectedInputUrl(
			t,
			"https://.s3-accesspoint.us-east-1.amazonaws.com/key?signature",
		);
	});

	test("It should accept every supporting access point host shape by default", async (t) => {
		for (const host of [
			"my-s3-ap-111122223333.s3-accesspoint.us-east-1.amazonaws.com",
			"my-s3-ap-111122223333.s3-accesspoint-fips.us-gov-west-1.amazonaws.com",
			"my-s3-ap-111122223333.s3-accesspoint.dualstack.eu-west-1.amazonaws.com",
			"my-s3-ap-111122223333.s3-accesspoint-fips.dualstack.us-east-2.amazonaws.com",
			"my-s3-ap-111122223333.s3-accesspoint.cn-north-1.amazonaws.com.cn",
			"my-s3-ap-111122223333.s3-accesspoint.dualstack.cn-northwest-1.amazonaws.com.cn",
		]) {
			await expectAcceptedInputUrl(t, `https://${host}/key?signature`);
		}
	});

	test("It should reject an inputS3Url with an explicit port", async (t) => {
		await expectRejectedInputUrl(t, `${awsOrigin}:8443/key?signature`);
		// A port can't be allow-listed, so a host carrying one is always refused.
		await expectRejectedInputUrl(t, "https://s3.minio.internal:9000/k", {
			allowedHosts: ["minio.internal"],
		});
	});

	test("It should treat the default https port as no port", async (t) => {
		await expectAcceptedInputUrl(t, `${awsOrigin}:443/key?signature`);
	});

	test("It should compare allowedHosts entries case-insensitively and as punycode", async (t) => {
		await expectAcceptedInputUrl(t, "https://s3.minio.internal/k", {
			allowedHosts: ["MinIO.Internal"],
		});
		await expectAcceptedInputUrl(t, "https://xn--bcher-kva.example/k", {
			allowedHosts: ["bücher.example"],
		});
		await expectAcceptedInputUrl(t, "https://BÜCHER.example/k", {
			allowedHosts: ["xn--bcher-kva.example"],
		});
	});

	test("It should reject an allowedHosts entry that is not a bare hostname at construction", () => {
		for (const entry of [
			"a b",
			"minio.internal:9000",
			"minio.internal/bucket",
			"user@minio.internal",
			"",
		]) {
			let caught;
			try {
				s3ObjectResponse({ allowedHosts: [entry] });
			} catch (e) {
				caught = e;
			}
			ok(caught instanceof TypeError, `entry ${JSON.stringify(entry)}`);
			strictEqual(
				caught.message,
				"@middy/s3-object-response: allowedHosts entry must be a bare hostname",
			);
			strictEqual(caught.cause.package, "@middy/s3-object-response");
			strictEqual(caught.cause.data.entry, entry);
		}
	});

	test("It should not spread a Buffer, string or stream handler response into WriteGetObjectResponse fields", async (t) => {
		t.mock.method(globalThis, "fetch", async () => new Response("ignored"));
		let captured;
		class AwsClient {
			send(command) {
				captured = command;
				return Promise.resolve({ statusCode: 200 });
			}
		}
		const route = {
			RequestRoute: defaultEvent.getObjectContext.outputRoute,
			RequestToken: defaultEvent.getObjectContext.outputToken,
		};
		const run = (response) =>
			middy(async () => response).use(s3ObjectResponse({ AwsClient }))(
				defaultEvent,
				defaultContext,
			);

		const buffer = Buffer.from("raw-bytes");
		await run(buffer);
		deepStrictEqual(captured.input, { ...route, Body: buffer });
		strictEqual(captured.input[0], undefined);

		await run("text");
		deepStrictEqual(captured.input, { ...route, Body: "text" });

		const stream = Readable.from(["chunk"]);
		await run(stream);
		strictEqual(captured.input.Body, stream);
		deepStrictEqual(Object.keys(captured.input).sort(), [
			"Body",
			"RequestRoute",
			"RequestToken",
		]);

		// A null-prototype object is still a plain field map.
		const bare = Object.create(null);
		bare.Body = "bare";
		bare.ContentType = "text/plain";
		await run(bare);
		deepStrictEqual(captured.input, {
			...route,
			Body: "bare",
			ContentType: "text/plain",
		});
	});

	test("It should send no Body when the handler returns null", async (t) => {
		t.mock.method(globalThis, "fetch", async () => new Response("ignored"));
		let captured;
		class AwsClient {
			send(command) {
				captured = command;
				return Promise.resolve({ statusCode: 200 });
			}
		}
		// null is not a field map and must not be walked for a prototype.
		const handler = middy(async () => null).use(
			s3ObjectResponse({ AwsClient }),
		);

		const response = await handler(defaultEvent, defaultContext);

		strictEqual(response.statusCode, 200);
		deepStrictEqual(captured.input, {
			RequestRoute: defaultEvent.getObjectContext.outputRoute,
			RequestToken: defaultEvent.getObjectContext.outputToken,
			Body: undefined,
		});
	});

	test("It should rebuild the client when the assumed-role credentials are refetched", async (t) => {
		t.mock.method(globalThis, "fetch", async () => new Response("body"));
		const constructions = [];
		class FakeClient {
			constructor(awsClientOptions) {
				constructions.push(awsClientOptions);
			}
			send() {
				return Promise.resolve({ statusCode: 200 });
			}
		}
		let credentials = Promise.resolve({ accessKeyId: "a" });
		const handler = middy(async () => ({ Body: "body" }))
			.before((request) => {
				request.internal.role = credentials;
			})
			.use(
				s3ObjectResponse({
					AwsClient: FakeClient,
					awsClientAssumeRole: "role",
				}),
			);

		await handler(defaultEvent, defaultContext);
		// A later invocation carrying the same cached credential promise keeps
		// the client.
		await handler(defaultEvent, defaultContext);
		strictEqual(constructions.length, 1);
		deepStrictEqual(constructions[0].credentials, { accessKeyId: "a" });

		// sts refetched: request.internal now holds a new promise object, so the
		// client is rebuilt with the new session instead of keeping the expired one.
		credentials = Promise.resolve({ accessKeyId: "b" });
		await handler(defaultEvent, defaultContext);
		strictEqual(constructions.length, 2);
		deepStrictEqual(constructions[1].credentials, { accessKeyId: "b" });
		await handler(defaultEvent, defaultContext);
		strictEqual(constructions.length, 2);
	});

	test("It should construct the client once without awsClientAssumeRole", async (t) => {
		t.mock.method(globalThis, "fetch", async () => new Response("body"));
		let constructed = 0;
		class FakeClient {
			constructor() {
				constructed += 1;
			}
			send() {
				return Promise.resolve({ statusCode: 200 });
			}
		}
		const handler = middy(async () => ({ Body: "body" })).use(
			s3ObjectResponse({
				AwsClient: FakeClient,
				disablePrefetch: true,
			}),
		);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);
		strictEqual(constructed, 1);
	});
});
