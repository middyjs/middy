import { SSMClient } from "@aws-sdk/client-ssm";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda/handler";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expectAssignable, expectType } from "tsd";
import ssm, { type Context, ssmParam } from ".";

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(ssm());

// use with all options
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
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
	ssm(options),
);

expectType<
	middy.MiddlewareObj<
		unknown,
		any,
		Error,
		LambdaContext,
		Record<"lorem" | "ipsum", unknown>
	>
>(
	ssm({
		fetchData: {
			lorem: "/lorem",
			ipsum: "/lorem",
		},
	}),
);

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

// chain of multiple ssm middleware
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

		expectType<string>(data.accessToken);
		expectType<{ user: string; pass: string }>(data.dbParams);
		expectType<string>(data.defaults);

		// make sure data is set to context as well (only for the second instantiation of the middleware)
		expectAssignable<{
			accessToken: string;
			dbParams: { user: string; pass: string };
		}>(request.context);
	});
