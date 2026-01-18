import { deepStrictEqual, ok } from "node:assert/strict";
import { test } from "node:test";
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { MockAgent, setGlobalDispatcher } from "undici";
import middy from "../core/index.js";
import { clearCache } from "../util/index.js";

import s3ObejctResponse from "./index.js";

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
		s3ObejctResponse({
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
		s3ObejctResponse({
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
		s3ObejctResponse({
			AwsClient: S3Client,
			disablePrefetch: true,
		}),
	);

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(200, response.statusCode);
});
