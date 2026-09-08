import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
import { test } from "node:test";

import middy from "../core/index.js";

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
	// A non-object option must be rejected via the JSON-Schema object rule
	// (message "Option '' must be object"), not the flat-schema fallback
	// ("options must be an object") that an empty schema would produce.
	try {
		cloudformationResponseValidateOptions("not-an-object");
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.message, "Option '' must be object");
		strictEqual(e.cause.package, "@middy/cloudformation-response");
	}
});

test("It should fall back to String(request.error) when error has no message", async (t) => {
	const middleware = cloudformationResponse();
	const request = {
		event: defaultEvent,
		context: defaultContext,
		error: null,
		response: undefined,
	};
	await middleware.onError(request);
	deepStrictEqual(request.response, {
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

test("It should throw a package error when the ResponseURL rejects the PUT", async (t) => {
	const calls = fetchSpy(t, 403);
	const handler = middy(() => ({})).use(cloudformationResponse());

	await rejects(
		() => handler(eventWithUrl, defaultContext),
		(e) => {
			// `after` fails, `onError` retries once with a FAILED body, which
			// fails too; core surfaces both.
			const [first, second] = e.errors;
			strictEqual(
				first.message,
				"@middy/cloudformation-response: CloudFormation rejected the response (403)",
			);
			strictEqual(first.cause.package, "@middy/cloudformation-response");
			strictEqual(first.cause.data.status, 403);
			strictEqual(second.cause.package, "@middy/cloudformation-response");
			return true;
		},
	);
	strictEqual(calls.length, 2);
	strictEqual(JSON.parse(calls[1].init.body).Status, "FAILED");
});

test("It should propagate a network failure of the PUT", async (t) => {
	t.mock.method(globalThis, "fetch", async () => {
		throw new TypeError("fetch failed");
	});
	const handler = middy(() => ({})).use(cloudformationResponse());

	await rejects(
		() => handler(eventWithUrl, defaultContext),
		(e) => {
			strictEqual(e.errors[0].message, "fetch failed");
			return true;
		},
	);
});
