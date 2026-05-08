import { SSMClient } from "@aws-sdk/client-ssm";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import ssm, { type Context, ssmParam } from "./index.js";

test("use with default options", () => {
	expect(ssm()).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<undefined>>
	>();
});

test("use with all options", () => {
	const options = {
		AwsClient: SSMClient,
		awsClientOptions: {
			credentials: {
				secretAccessKey: "secret",
				sessionToken: "token",
				accessKeyId: "key",
			},
		},
		awsClientAssumeRole: "some-role",
		awsClientCapture: captureAWSv3Client,
		disablePrefetch: true,
	};
	expect(ssm(options)).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<typeof options>>
	>();

	expect(
		ssm({
			fetchData: {
				lorem: "/lorem",
				ipsum: "/lorem",
			},
		}),
	).type.toBe<
		middy.MiddlewareObj<
			unknown,
			unknown,
			Error,
			LambdaContext,
			Record<"lorem" | "ipsum", unknown>
		>
	>();
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("chain of multiple ssm middleware", () => {
	handler
		.use(
			ssm({
				fetchData: {
					defaults: ssmParam<string>("/dev/defaults"),
				},
				cacheKey: "ssm-defaults",
			}),
		)
		.use(
			ssm({
				fetchData: {
					accessToken: ssmParam<string>("/dev/service_name/access_token"), // single value
					dbParams: ssmParam<{ user: string; pass: string }>(
						"/dev/service_name/database/",
					), // object of values, key for each path
				},
				cacheExpiry: 15 * 60 * 1000,
				cacheKey: "ssm-secrets",
				setToContext: true,
			}),
		)
		// ... other middleware that fetch
		.before(async (request) => {
			const data = await getInternal(
				["accessToken", "dbParams", "defaults"],
				request,
			);

			expect(data.accessToken).type.toBe<string>();
			expect(data.dbParams).type.toBe<{ user: string; pass: string }>();
			expect(data.defaults).type.toBe<string>();

			// make sure data is set to context as well (only for the second instantiation of the middleware)
			expect(request.context).type.toBeAssignableTo<{
				accessToken: string;
				dbParams: { user: string; pass: string };
			}>();
		});
});
