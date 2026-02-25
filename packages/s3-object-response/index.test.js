import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { MockAgent, setGlobalDispatcher } from "undici";
import middy from "../core/index.js";
import { clearCache } from "../util/index.js";

import s3ObjectResponse from "./index.js";

let agent;
test.beforeEach((t) => {
	agent = new MockAgent();
	setGlobalDispatcher(agent);
});
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
	agent
		.get(awsOrigin)
		.intercept({
			path: "/key?signature",
			method: "GET",
		})
		.reply(200, s3Data, {
			headers: {
				"Content-Type": "application/json; charset=UTF-8",
			},
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
	agent
		.get(awsOrigin)
		.intercept({
			path: "/key?signature",
			method: "GET",
		})
		.reply(200, s3Data, {
			headers: {
				"Content-Type": "application/json; charset=UTF-8",
			},
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
	agent
		.get(awsOrigin)
		.intercept({
			path: "/key?signature",
			method: "GET",
		})
		.reply(200, s3Data, {
			headers: {
				"Content-Type": "application/json; charset=UTF-8",
			},
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
