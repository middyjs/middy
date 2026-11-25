import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
import { describe, test } from "node:test";
import timers from "node:timers/promises";

import middy from "@middy/core";

import cloudformationResponse, {
	cloudformationResponseValidateOptions,
} from "./index.js";

const defaultEvent = {
	RequestType: "Create",
	RequestId: "RequestId",
	LogicalResourceId: "LogicalResourceId",
	StackId: "StackId",
};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
	logStreamName: "2026/03/14/[$LATEST]abcdef1234567890",
};

describe("@middy/cloudformation-response", () => {
	test("It should return SUCCESS when empty response", async (t) => {
		const handler = middy((event, context) => {});

		handler.use(cloudformationResponse());

		const event = defaultEvent;
		const response = await handler(event, defaultContext);
		deepStrictEqual(response, {
			Status: "SUCCESS",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "2026/03/14/[$LATEST]abcdef1234567890",
		});
	});

	test("It should return SUCCESS when empty object", async (t) => {
		const handler = middy((event, context) => {
			return {};
		});

		handler.use(cloudformationResponse());

		const event = defaultEvent;
		const response = await handler(event, defaultContext);
		deepStrictEqual(response, {
			Status: "SUCCESS",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "2026/03/14/[$LATEST]abcdef1234567890",
		});
	});

	test("It should return FAILURE when error thrown", async (t) => {
		const handler = middy((event, context) => {
			throw new Error("Internal Error");
		});

		handler.use(cloudformationResponse());

		const event = defaultEvent;
		const response = await handler(event, defaultContext);
		deepStrictEqual(response, {
			Status: "FAILED",
			Reason: "Internal Error",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "2026/03/14/[$LATEST]abcdef1234567890",
		});
	});

	test("It should use event.PhysicalResourceId on Update", async (t) => {
		const handler = middy((event, context) => {});

		handler.use(cloudformationResponse());

		const event = {
			...defaultEvent,
			RequestType: "Update",
			PhysicalResourceId: "custom-physical-id",
		};
		const response = await handler(event, defaultContext);
		deepStrictEqual(response, {
			Status: "SUCCESS",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "custom-physical-id",
		});
	});

	test("It should use event.PhysicalResourceId on Delete", async (t) => {
		const handler = middy((event, context) => {});

		handler.use(cloudformationResponse());

		const event = {
			...defaultEvent,
			RequestType: "Delete",
			PhysicalResourceId: "custom-physical-id",
		};
		const response = await handler(event, defaultContext);
		deepStrictEqual(response, {
			Status: "SUCCESS",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "custom-physical-id",
		});
	});

	test("It should prefer handler-set PhysicalResourceId over event", async (t) => {
		const handler = middy((event, context) => {
			return { PhysicalResourceId: "handler-id" };
		});

		handler.use(cloudformationResponse());

		const event = {
			...defaultEvent,
			RequestType: "Update",
			PhysicalResourceId: "event-id",
		};
		const response = await handler(event, defaultContext);
		deepStrictEqual(response, {
			Status: "SUCCESS",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "handler-id",
		});
	});

	test("It should use event.PhysicalResourceId on error during Update", async (t) => {
		const handler = middy((event, context) => {
			throw new Error("Update Error");
		});

		handler.use(cloudformationResponse());

		const event = {
			...defaultEvent,
			RequestType: "Update",
			PhysicalResourceId: "custom-physical-id",
		};
		const response = await handler(event, defaultContext);
		deepStrictEqual(response, {
			Status: "FAILED",
			Reason: "Update Error",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "custom-physical-id",
		});
	});

	test("It should return FAILURE when a non-object is thrown", async (t) => {
		const handler = middy((event, context) => {
			throw "string error";
		});

		handler.use(cloudformationResponse());

		const event = defaultEvent;
		const response = await handler(event, defaultContext);
		deepStrictEqual(response, {
			Status: "FAILED",
			Reason: "string error",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "2026/03/14/[$LATEST]abcdef1234567890",
		});
	});

	test("It should not send an empty Reason when the thrown error has an empty message", async (t) => {
		const handler = middy(() => {
			throw new Error();
		}).use(cloudformationResponse());

		const response = await handler(defaultEvent, defaultContext);
		strictEqual(response.Status, "FAILED");
		strictEqual(response.Reason, "Error");
	});

	test("It should default an empty Reason on a FAILED response", async (t) => {
		const handler = middy(() => ({ Status: "FAILED", Reason: "" })).use(
			cloudformationResponse(),
		);

		const response = await handler(defaultEvent, defaultContext);
		// Reason is required when Status is FAILED.
		strictEqual(response.Reason, "See CloudWatch logs");
	});

	test("It should not override response values", async (t) => {
		const handler = middy((event, context) => {
			return {
				Status: "FAILED",
				RequestId: "RequestId*",
				LogicalResourceId: "LogicalResourceId*",
				StackId: "StackId*",
			};
		});

		handler.use(cloudformationResponse());

		const event = defaultEvent;
		const response = await handler(event, defaultContext);
		deepStrictEqual(response, {
			Status: "FAILED",
			// Required by CloudFormation when Status is FAILED, so it is defaulted.
			Reason: "See CloudWatch logs",
			RequestId: "RequestId*",
			LogicalResourceId: "LogicalResourceId*",
			StackId: "StackId*",
			PhysicalResourceId: "2026/03/14/[$LATEST]abcdef1234567890",
		});
	});

	test("cloudformationResponseValidateOptions accepts sendResponse and rejects anything else", () => {
		cloudformationResponseValidateOptions({});
		cloudformationResponseValidateOptions();
		cloudformationResponseValidateOptions({ sendResponse: false });
		try {
			cloudformationResponseValidateOptions({ sendResponse: "no" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/cloudformation-response");
		}
		try {
			cloudformationResponseValidateOptions({ any: 1 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/cloudformation-response");
		}
	});

	test("cloudformationResponseValidateOptions validates options as a typed object schema", () => {
		// Read as a flat schema, `{ type: "object", properties, ... }` would make
		// `type` an allowed option that must be an object, so `{ type: {} }` would
		// pass. Only the JSON-Schema form treats `type` as a keyword, so here it
		// is an unknown option.
		try {
			cloudformationResponseValidateOptions({ type: {} });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.message, "Unknown option 'type'");
			strictEqual(e.cause.package, "@middy/cloudformation-response");
		}
		try {
			cloudformationResponseValidateOptions("not-an-object");
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.message, "options must be an object");
		}
	});

	test("It should fall back to String(request.error) when error has no message", async (t) => {
		const handler = middy(() => {
			throw null;
		}).use(cloudformationResponse());

		const response = await handler(defaultEvent, defaultContext);
		deepStrictEqual(response, {
			Status: "FAILED",
			Reason: "null",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "2026/03/14/[$LATEST]abcdef1234567890",
		});
	});

	// ---------- delivery to event.ResponseURL ----------

	const responseUrl =
		"https://cloudformation-custom-resource-response-useast1.s3.amazonaws.com/arn%3Aaws%3Acloudformation%3Aus-east-1%3A123456789012%3Astack%2Fmystack%2Fid%7CLogicalResourceId%7CRequestId?X-Amz-Signature=signature";
	const eventWithUrl = { ...defaultEvent, ResponseURL: responseUrl };

	const fetchSpy = (t, status = 200) => {
		const calls = [];
		t.mock.method(globalThis, "fetch", async (url, init) => {
			calls.push({ url, init });
			return new Response(null, { status });
		});
		return calls;
	};

	test("It should PUT the shaped response to event.ResponseURL and still return it", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => ({ Data: { Arn: "arn:aws:example" } })).use(
			cloudformationResponse(),
		);

		const response = await handler(eventWithUrl, defaultContext);

		const expected = {
			Status: "SUCCESS",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "2026/03/14/[$LATEST]abcdef1234567890",
			Data: { Arn: "arn:aws:example" },
		};
		deepStrictEqual(response, expected);
		strictEqual(calls.length, 1);
		strictEqual(calls[0].url, responseUrl);
		strictEqual(calls[0].init.method, "PUT");
		// The presigned URL was signed with an empty content type; any other value
		// fails the signature check on the bucket.
		strictEqual(calls[0].init.headers["content-type"], "");
		deepStrictEqual(JSON.parse(calls[0].init.body), expected);
	});

	test("It should PUT a FAILED response when the handler throws", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => {
			throw new Error("Internal Error");
		}).use(cloudformationResponse());

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "FAILED");
		strictEqual(calls.length, 1);
		const sent = JSON.parse(calls[0].init.body);
		strictEqual(sent.Status, "FAILED");
		strictEqual(sent.Reason, "Internal Error");
	});

	test("It should truncate Reason so the body stays within 4096 bytes and note it", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => {
			throw new Error("x".repeat(5000));
		}).use(cloudformationResponse());

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(calls.length, 1);
		const { body } = calls[0].init;
		ok(Buffer.byteLength(body) <= 4096);
		const sent = JSON.parse(body);
		ok(sent.Reason.endsWith(" [truncated]"));
		ok(sent.Reason.startsWith("xxxx"));
		// The returned object carries the same Reason CloudFormation received.
		strictEqual(response.Reason, sent.Reason);
	});

	test("It should truncate a multi-byte Reason by bytes, not characters", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => {
			throw new Error("é".repeat(3000));
		}).use(cloudformationResponse());

		await handler(eventWithUrl, defaultContext);

		ok(Buffer.byteLength(calls[0].init.body) <= 4096);
		ok(JSON.parse(calls[0].init.body).Reason.endsWith(" [truncated]"));
	});

	test("It should keep a body of exactly 4096 bytes untouched", async (t) => {
		// Boundary: the limit is inclusive.
		const calls = fetchSpy(t);
		const base = {
			Status: "SUCCESS",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "p",
			Reason: "",
		};
		const reason = "r".repeat(4096 - Buffer.byteLength(JSON.stringify(base)));
		const handler = middy(() => ({
			PhysicalResourceId: "p",
			Reason: reason,
		})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(Buffer.byteLength(calls[0].init.body), 4096);
		strictEqual(response.Reason, reason);
	});

	test("It should report FAILED when the body cannot fit in 4096 bytes and there is no Reason to trim", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => ({ Data: { blob: "d".repeat(5000) } })).use(
			cloudformationResponse(),
		);

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "FAILED");
		ok(response.Reason.includes("4096"));
		strictEqual(calls.length, 1);
		const sent = JSON.parse(calls[0].init.body);
		strictEqual(sent.Status, "FAILED");
		strictEqual(sent.Data, undefined);
		ok(Buffer.byteLength(calls[0].init.body) <= 4096);
	});

	test("It should report FAILED when trimming Reason alone cannot bring the body under 4096 bytes", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => ({
			Data: { blob: "d".repeat(5000) },
			Reason: "short",
		})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "FAILED");
		ok(response.Reason.includes("4096"));
		strictEqual(calls.length, 1);
		ok(Buffer.byteLength(calls[0].init.body) <= 4096);
	});

	test("It should skip the PUT when sendResponse is false", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => ({})).use(
			cloudformationResponse({ sendResponse: false }),
		);

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "SUCCESS");
		deepStrictEqual(calls, []);
	});

	test("It should skip the PUT when event.ResponseURL is missing", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => ({})).use(cloudformationResponse());

		const response = await handler(defaultEvent, defaultContext);

		strictEqual(response.Status, "SUCCESS");
		deepStrictEqual(calls, []);
	});

	test("It should report a primitive handler response as FAILED instead of throwing 'Cannot create property'", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => "done").use(cloudformationResponse());

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "FAILED");
		ok(response.Reason.includes("must be an object"));
		strictEqual(calls.length, 1);
		strictEqual(JSON.parse(calls[0].init.body).Status, "FAILED");
	});

	test("It should report an array handler response as FAILED", async (t) => {
		fetchSpy(t);
		const handler = middy(() => [1]).use(cloudformationResponse());

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "FAILED");
		ok(response.Reason.includes("must be an object"));
	});

	test("It should name the offending type in the cause of a non-object handler response", async (t) => {
		fetchSpy(t);
		// onError hooks run last-registered first, so this one sees the TypeError
		// before the middleware's own onError turns it into a FAILED response.
		const seen = [];
		const capture = {
			onError: (request) => {
				seen.push(request.error);
			},
		};
		for (const [value, type] of [
			["done", "string"],
			[1, "number"],
			[[1], "array"],
		]) {
			const handler = middy(() => value)
				.use(cloudformationResponse())
				.use(capture);
			const response = await handler(eventWithUrl, defaultContext);
			strictEqual(response.Status, "FAILED");
			const error = seen.pop();
			ok(error instanceof TypeError);
			strictEqual(
				error.message,
				"@middy/cloudformation-response: handler response must be an object",
			);
			deepStrictEqual(error.cause, {
				package: "@middy/cloudformation-response",
				data: { type },
			});
		}
	});

	test("It should report the byte count in the cause when the body cannot fit in 4096 bytes", async (t) => {
		const calls = fetchSpy(t);
		let error;
		const capture = {
			onError: (request) => {
				error = request.error;
			},
		};
		const Data = { blob: "d".repeat(5000) };
		const handler = middy(() => ({ Data }))
			.use(cloudformationResponse())
			.use(capture);

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "FAILED");
		strictEqual(
			error.message,
			"@middy/cloudformation-response: response body exceeds 4096 bytes",
		);
		// The reported size is that of the fully shaped body, ids included.
		const bytes = Buffer.byteLength(
			JSON.stringify({
				Data,
				Status: "SUCCESS",
				RequestId: "RequestId",
				LogicalResourceId: "LogicalResourceId",
				StackId: "StackId",
				PhysicalResourceId: defaultContext.logStreamName,
			}),
		);
		ok(bytes > 4096);
		deepStrictEqual(error.cause, {
			package: "@middy/cloudformation-response",
			data: { bytes },
		});
		// Only the FAILED retry reaches CloudFormation; the oversize body never does.
		strictEqual(calls.length, 1);
	});

	const fetchSequence = (t, outcomes) => {
		const calls = [];
		const pending = [...outcomes];
		t.mock.method(globalThis, "fetch", async (url, init) => {
			calls.push({ url, init });
			const outcome = pending.shift() ?? 200;
			if (outcome instanceof Error) throw outcome;
			if (outcome instanceof Response) return outcome;
			return new Response(null, { status: outcome });
		});
		return calls;
	};

	const s3Error = (status, code) =>
		new Response(
			`<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>${code}</Code><Message>Reduce your request rate.</Message><RequestId>4442587FB7D0A2F9</RequestId></Error>`,
			{ status, headers: { "content-type": "application/xml" } },
		);

	const backoffSpy = (t, random = 1) => {
		const delays = [];
		t.mock.timers.enable({ apis: ["Date"], now: 0 });
		t.mock.method(Math, "random", () => random);
		t.mock.method(timers, "setTimeout", async (ms) => {
			delays.push(ms);
			t.mock.timers.tick(ms);
		});
		return delays;
	};

	test("It should send the same SUCCESS body again when the PUT is answered with a 503", async (t) => {
		backoffSpy(t);
		const calls = fetchSequence(t, [503]);
		const handler = middy(() => ({
			PhysicalResourceId: "real-resource-id-123",
			Data: { Arn: "arn:aws:example" },
		})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "SUCCESS");
		strictEqual(response.PhysicalResourceId, "real-resource-id-123");
		strictEqual(calls.length, 2);
		strictEqual(calls[1].init.body, calls[0].init.body);
		strictEqual(JSON.parse(calls[1].init.body).Status, "SUCCESS");
	});

	test("It should wait between attempts with a jittered delay that doubles", async (t) => {
		const delays = backoffSpy(t, 0.5);
		const calls = fetchSequence(t, [503, 503, 503]);
		const handler = middy(() => ({})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, {
			...defaultContext,
			getRemainingTimeInMillis: () => 10_000,
		});

		strictEqual(response.Status, "SUCCESS");
		strictEqual(calls.length, 4);
		deepStrictEqual(delays, [25, 50, 100]);
		strictEqual(new Set(calls.map(({ init }) => init.signal)).size, 1);
	});

	test("It should cap the wait between attempts at 20 s", async (t) => {
		const delays = backoffSpy(t);
		const calls = fetchSequence(t, Array(10).fill(503));
		const handler = middy(() => ({})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, {
			...defaultContext,
			getRemainingTimeInMillis: () => 900_000,
		});

		strictEqual(response.Status, "SUCCESS");
		strictEqual(calls.length, 11);
		deepStrictEqual(
			delays,
			[50, 100, 200, 400, 800, 1600, 3200, 6400, 12_800, 20_000],
		);
	});

	test("It should stop sending a body again once the next wait would reach the deadline", async (t) => {
		const delays = backoffSpy(t);
		const calls = fetchSequence(t, Array(20).fill(503));
		const handler = middy(() => ({})).use(cloudformationResponse());

		await rejects(
			() =>
				handler(eventWithUrl, {
					...defaultContext,
					getRemainingTimeInMillis: () => 2050 - Date.now(),
				}),
			(e) => {
				for (const error of e.errors) {
					strictEqual(
						error.message,
						"@middy/cloudformation-response: CloudFormation rejected the response (503)",
					);
					strictEqual(error.cause.data.status, 503);
				}
				return true;
			},
		);
		deepStrictEqual(delays, [50, 100, 200, 400, 50, 100, 200, 400]);
		deepStrictEqual(
			calls.map(({ init }) => JSON.parse(init.body).Status),
			[...Array(5).fill("SUCCESS"), ...Array(5).fill("FAILED")],
		);
	});

	test("It should send the body again after a 500, 502, 503 or 504 answer", async (t) => {
		const delays = backoffSpy(t);
		for (const status of [500, 502, 503, 504]) {
			const calls = fetchSequence(t, [status]);
			const handler = middy(() => ({})).use(cloudformationResponse());

			const response = await handler(eventWithUrl, defaultContext);

			strictEqual(response.Status, "SUCCESS", `${status}`);
			strictEqual(calls.length, 2, `${status}`);
			strictEqual(JSON.parse(calls[1].init.body).Status, "SUCCESS");
		}
		deepStrictEqual(delays, [50, 50, 50, 50]);
	});

	test("It should not send the same body again after a 429 or another 5xx answer", async (t) => {
		const delays = backoffSpy(t);
		for (const status of [429, 501, 505, 599]) {
			const calls = fetchSequence(t, Array(20).fill(status));
			const handler = middy(() => ({})).use(cloudformationResponse());

			await rejects(
				() => handler(eventWithUrl, defaultContext),
				(e) => {
					strictEqual(
						e.errors[0].message,
						`@middy/cloudformation-response: CloudFormation rejected the response (${status})`,
					);
					return true;
				},
			);
			deepStrictEqual(
				calls.map(({ init }) => JSON.parse(init.body).Status),
				["SUCCESS", "FAILED"],
				`${status}`,
			);
		}
		deepStrictEqual(delays, []);
	});

	test("It should back off from a 1 s base after an S3 SlowDown answer", async (t) => {
		const delays = backoffSpy(t);
		const calls = fetchSequence(
			t,
			Array.from({ length: 7 }, () => s3Error(503, "SlowDown")),
		);
		const handler = middy(() => ({})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, {
			...defaultContext,
			getRemainingTimeInMillis: () => 900_000,
		});

		strictEqual(response.Status, "SUCCESS");
		strictEqual(calls.length, 8);
		deepStrictEqual(delays, [1000, 2000, 4000, 8000, 16_000, 20_000, 20_000]);
	});

	test("It should pick the base delay from the S3 error code before the status", async (t) => {
		const delays = backoffSpy(t);
		const calls = fetchSequence(t, [
			s3Error(503, "SlowDown"),
			s3Error(503, "ServiceUnavailable"),
		]);
		const handler = middy(() => ({})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, {
			...defaultContext,
			getRemainingTimeInMillis: () => 900_000,
		});

		strictEqual(response.Status, "SUCCESS");
		strictEqual(calls.length, 3);
		deepStrictEqual(delays, [1000, 100]);
	});

	test("It should send the body again after an S3 RequestTimeout answer", async (t) => {
		const delays = backoffSpy(t);
		const calls = fetchSequence(t, [s3Error(400, "RequestTimeout")]);
		const handler = middy(() => ({})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "SUCCESS");
		strictEqual(calls.length, 2);
		deepStrictEqual(delays, [50]);
	});

	test("It should not send the same body again after an S3 error code that is not retried", async (t) => {
		const delays = backoffSpy(t);
		const calls = fetchSequence(t, [
			s3Error(403, "SignatureDoesNotMatch"),
			s3Error(403, "SignatureDoesNotMatch"),
		]);
		const handler = middy(() => ({})).use(cloudformationResponse());

		await rejects(() => handler(eventWithUrl, defaultContext));

		strictEqual(calls.length, 2);
		deepStrictEqual(delays, []);
	});

	test("It should send the body again when reading the error answer fails", async (t) => {
		const delays = backoffSpy(t);
		const failure = new TypeError("terminated");
		const calls = fetchSequence(t, [
			new Response(
				new ReadableStream({
					start(controller) {
						controller.error(failure);
					},
				}),
				{ status: 403 },
			),
		]);
		const handler = middy(() => ({})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "SUCCESS");
		strictEqual(calls.length, 2);
		deepStrictEqual(delays, [50]);
	});

	test("It should send the body again after a network failure", async (t) => {
		const delays = backoffSpy(t);
		const calls = fetchSequence(t, [new TypeError("fetch failed")]);
		const handler = middy(() => ({
			PhysicalResourceId: "real-resource-id-123",
		})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "SUCCESS");
		strictEqual(response.PhysicalResourceId, "real-resource-id-123");
		strictEqual(calls.length, 2);
		strictEqual(calls[1].init.body, calls[0].init.body);
		deepStrictEqual(delays, [50]);
	});

	test("It should propagate a network failure of the PUT once the deadline rules out another attempt", async (t) => {
		const delays = backoffSpy(t);
		const calls = fetchSequence(
			t,
			Array.from({ length: 20 }, () => new TypeError("fetch failed")),
		);
		const handler = middy(() => ({})).use(cloudformationResponse());

		await rejects(
			() =>
				handler(eventWithUrl, {
					...defaultContext,
					getRemainingTimeInMillis: () => 2000 - Date.now(),
				}),
			(e) => {
				deepStrictEqual(
					e.errors.map((error) => error.message),
					["fetch failed", "fetch failed"],
				);
				return true;
			},
		);
		deepStrictEqual(delays, [50, 100, 200, 400, 50, 100, 200, 400]);
		strictEqual(calls.length, 10);
	});

	test("It should not send the same body again when the ResponseURL answers 4xx", async (t) => {
		const delays = backoffSpy(t);
		for (const status of [400, 403, 404, 499]) {
			const calls = fetchSequence(t, Array(20).fill(status));
			const handler = middy(() => ({})).use(cloudformationResponse());

			await rejects(
				() => handler(eventWithUrl, defaultContext),
				(e) => {
					const [first, second] = e.errors;
					strictEqual(
						first.message,
						`@middy/cloudformation-response: CloudFormation rejected the response (${status})`,
					);
					deepStrictEqual(first.cause, {
						package: "@middy/cloudformation-response",
						data: { status },
					});
					strictEqual(second.cause.package, "@middy/cloudformation-response");
					return true;
				},
			);
			deepStrictEqual(
				calls.map(({ init }) => JSON.parse(init.body).Status),
				["SUCCESS", "FAILED"],
				`${status}`,
			);
		}
		deepStrictEqual(delays, []);
	});

	test("It should keep the handler's PhysicalResourceId in the FAILED body that follows a failed delivery", async (t) => {
		backoffSpy(t);
		const calls = fetchSequence(t, [403]);
		const handler = middy(() => ({
			PhysicalResourceId: "handler-id",
			Data: { Arn: "arn:aws:example" },
		})).use(cloudformationResponse());

		const response = await handler(
			{
				...eventWithUrl,
				RequestType: "Update",
				PhysicalResourceId: "event-id",
			},
			defaultContext,
		);

		const expected = {
			Status: "FAILED",
			Reason:
				"@middy/cloudformation-response: CloudFormation rejected the response (403)",
			RequestId: "RequestId",
			LogicalResourceId: "LogicalResourceId",
			StackId: "StackId",
			PhysicalResourceId: "handler-id",
		};
		deepStrictEqual(response, expected);
		strictEqual(calls.length, 2);
		strictEqual(
			JSON.parse(calls[0].init.body).PhysicalResourceId,
			"handler-id",
		);
		deepStrictEqual(JSON.parse(calls[1].init.body), expected);
	});

	// ---------- Reason, PhysicalResourceId, ResponseURL and the PUT timeout ----------
	// Field rules per
	// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/crpg-ref-responses.html:
	// Reason is required when Status is FAILED, PhysicalResourceId must be a
	// non-empty string, the body is capped at 4096 bytes and the response goes
	// to a presigned S3 URL.

	const truncatedNote = " [truncated]";
	const reasonBody = (sent) => sent.Reason.slice(0, -truncatedNote.length);

	test("It should keep a body of exactly 4096 bytes when truncating a single-byte Reason", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => {
			throw new Error("x".repeat(5000));
		}).use(cloudformationResponse());

		await handler(eventWithUrl, defaultContext);

		const { body } = calls[0].init;
		strictEqual(Buffer.byteLength(body), 4096);
		const sent = JSON.parse(body);
		ok(sent.Reason.endsWith(truncatedNote));
		ok(/^x+$/.test(reasonBody(sent)));
	});

	test("It should keep as many whole multi-byte characters as fit when truncating Reason", async (t) => {
		// "é" is 2 bytes, "😀" is 4 bytes (a surrogate pair), and a double quote
		// costs 2 bytes once JSON-escaped. Each case must fill the cap to within
		// one character and never split a character.
		for (const [char, bytes] of [
			["é", 2],
			["😀", 4],
			['"', 2],
		]) {
			const calls = fetchSpy(t);
			const handler = middy(() => {
				throw new Error(char.repeat(3000));
			}).use(cloudformationResponse());

			const response = await handler(eventWithUrl, defaultContext);

			const { body } = calls[0].init;
			const size = Buffer.byteLength(body);
			ok(size <= 4096, `${char}: ${size} bytes`);
			ok(size + bytes > 4096, `${char}: one more character would not fit`);
			const sent = JSON.parse(body);
			ok(sent.Reason.isWellFormed(), `${char}: no split surrogate pair`);
			ok(sent.Reason.endsWith(truncatedNote));
			const kept = reasonBody(sent);
			ok(kept.length > 0);
			deepStrictEqual(
				[...new Set(kept)],
				[char],
				`${char}: only whole characters`,
			);
			strictEqual(response.Reason, sent.Reason);
		}
	});

	test("It should default Reason on a FAILED response the handler returned without one", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => ({ Status: "FAILED" })).use(
			cloudformationResponse(),
		);

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Reason, "See CloudWatch logs");
		strictEqual(JSON.parse(calls[0].init.body).Reason, "See CloudWatch logs");
	});

	test("It should not add a Reason to a SUCCESS response", async (t) => {
		fetchSpy(t);
		const handler = middy(() => ({})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Status, "SUCCESS");
		ok(!("Reason" in response));
	});

	test("It should keep a Reason the handler set on a FAILED response", async (t) => {
		fetchSpy(t);
		const handler = middy(() => ({ Status: "FAILED", Reason: "mine" })).use(
			cloudformationResponse(),
		);

		const response = await handler(eventWithUrl, defaultContext);

		strictEqual(response.Reason, "mine");
	});

	test("It should fall back to context.awsRequestId for PhysicalResourceId when logStreamName is absent", async (t) => {
		fetchSpy(t);
		const handler = middy(() => ({})).use(cloudformationResponse());

		const response = await handler(eventWithUrl, {
			getRemainingTimeInMillis: () => 1000,
			awsRequestId: "req-1",
		});

		strictEqual(response.PhysicalResourceId, "req-1");
	});

	test("It should throw a package error naming PhysicalResourceId when nothing provides one", async (t) => {
		const calls = fetchSpy(t);
		const handler = middy(() => ({})).use(cloudformationResponse());

		await rejects(
			() => handler(eventWithUrl, { getRemainingTimeInMillis: () => 1000 }),
			(e) => {
				// `after` fails, `onError` retries with a FAILED body that has the
				// same gap; core surfaces both.
				for (const error of e.errors) {
					strictEqual(
						error.message,
						"@middy/cloudformation-response: PhysicalResourceId is required and neither the event nor the context provides one",
					);
					deepStrictEqual(error.cause, {
						package: "@middy/cloudformation-response",
						data: { field: "PhysicalResourceId" },
					});
				}
				strictEqual(e.errors.length, 2);
				return true;
			},
		);
		deepStrictEqual(calls, []);
	});

	test("It should reject a ResponseURL that is not https without sending anything", async (t) => {
		for (const [ResponseURL, protocol] of [
			["http://example.com/response", "http:"],
			["ftp://example.com/response", "ftp:"],
			["not a url", undefined],
		]) {
			const calls = fetchSpy(t);
			const handler = middy(() => ({})).use(cloudformationResponse());

			await rejects(
				() => handler({ ...defaultEvent, ResponseURL }, defaultContext),
				(e) => {
					strictEqual(
						e.errors[0].message,
						"@middy/cloudformation-response: ResponseURL must be an https URL",
					);
					deepStrictEqual(e.errors[0].cause, {
						package: "@middy/cloudformation-response",
						data: { protocol },
					});
					return true;
				},
			);
			deepStrictEqual(calls, [], ResponseURL);
		}
	});

	test("It should bound the PUT with a timeout derived from the remaining invocation time", async (t) => {
		const timeouts = [];
		const signal = new AbortController().signal;
		t.mock.method(AbortSignal, "timeout", (ms) => {
			timeouts.push(ms);
			return signal;
		});
		for (const [context, expected] of [
			// 500 ms is kept back for the runtime; never below 1 s.
			[{ ...defaultContext, getRemainingTimeInMillis: () => 10_000 }, 9500],
			[{ ...defaultContext, getRemainingTimeInMillis: () => 1200 }, 1000],
			// Outside Lambda there is no budget to derive from.
			[{ logStreamName: "ls" }, 29_500],
		]) {
			const calls = fetchSpy(t);
			const handler = middy(() => ({})).use(cloudformationResponse());

			await handler(eventWithUrl, context);

			strictEqual(calls[0].init.signal, signal);
			strictEqual(timeouts.pop(), expected);
		}
	});
});
