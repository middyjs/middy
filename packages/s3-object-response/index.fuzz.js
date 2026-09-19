import { test } from "node:test";
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import fc from "fast-check";
import middy from "../core/index.js";
import middleware from "./index.js";

mockClient(S3Client)
	.on(WriteGetObjectResponseCommand)
	.resolves({ statusCode: 200 }); // Causes memory leak

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
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("fuzz `event` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), async (event) => {
			await handler(event, defaultContext);
		}),
		{
			numRuns: 10_000,

			examples: [],
		},
	);
});

test("fuzz `event` w/ `record`", async () => {
	// Any inputS3Url is either fetched (allowed host) or rejected with the
	// documented 400; no other error may escape.
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
				try {
					await handler(event, defaultContext);
				} catch (e) {
					if (e.statusCode !== 400) throw e;
				}
			},
		),
		{
			numRuns: 10_000,

			examples: [],
		},
	);
});

test("fuzz `event` w/ allowed inputS3Url host", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				getObjectContext: fc.record({
					// Every supporting access point host shape S3 Object Lambda
					// hands out, in the commercial, GovCloud and China partitions.
					inputS3Url: fc
						.tuple(
							fc.stringMatching(/^[a-z0-9]{1,30}$/),
							fc.constantFrom(
								"s3-accesspoint.us-east-1.amazonaws.com",
								"s3-accesspoint-fips.us-gov-west-1.amazonaws.com",
								"s3-accesspoint.dualstack.eu-west-1.amazonaws.com",
								"s3-accesspoint-fips.dualstack.us-east-2.amazonaws.com",
								"s3-accesspoint.cn-north-1.amazonaws.com.cn",
								"s3-accesspoint.dualstack.cn-northwest-1.amazonaws.com.cn",
							),
							fc.webPath(),
						)
						.map(
							([accessPoint, endpoint, path]) =>
								`https://${accessPoint}-111122223333.${endpoint}${path}`,
						),
					outputRoute: fc.webUrl(),
					outputToken: fc.string(),
				}),
				Body: fc.string(),
			}),
			async (event) => {
				await handler(event, defaultContext);
			},
		),
		{
			numRuns: 10_000,

			examples: [],
		},
	);
});
