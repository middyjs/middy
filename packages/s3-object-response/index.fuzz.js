import { test } from "node:test";
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

mockClient(S3Client)
	.on(WriteGetObjectResponseCommand)
	.resolves({ statusCode: 200 });
global.fetch = (url, request) => {
	return Promise.resolve(
		new Response("", {
			status: 200,
			statusText: "OK",
			headers: new Headers({
				"Content-Type": "application/json; charset=UTF-8",
			}),
		}),
	);
};

const handler = middy((event) => event).use(
	middleware({
		AwsClient: S3Client,
	}),
);
const context = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			await handler(event, context);
		}),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});

test("fuzz `event` w/ `record`", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				getObjectContext: fc.record({
					inputS3Url: fc.webUrl(),
					outputRoute: fc.webUrl(),
					outputToken: fc.string(),
				}),
				Body: fc.string(),
			}),
			async (event) => {
				await handler(event, context);
			},
		),
		{
			numRuns: 100_000,
			verbose: 2,

			examples: [],
		},
	);
});
