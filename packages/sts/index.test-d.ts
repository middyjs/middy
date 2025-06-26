import { STSClient } from "@aws-sdk/client-sts";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expectType } from "tsd";
import sts, { type AssumedRoleCredentials, type Context } from "./index.js";

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(sts());

// use with all options
const options = {
	AwsClient: STSClient,
	awsClientCapture: captureAWSv3Client,
	disablePrefetch: true,
};
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
	sts(options),
);

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

// setToContext: true
handler
	.use(
		sts({
			...options,
			fetchData: { foo: { RoleArn: "foo" } },
			setToContext: true,
		}),
	)
	.before(async (request) => {
		expectType<AssumedRoleCredentials>(request.context.foo);

		const data = await getInternal("foo", request);
		expectType<AssumedRoleCredentials>(data.foo);
	});

// setToContext: false
handler
	.use(
		sts({
			...options,
			fetchData: { foo: { RoleArn: "foo" } },
			setToContext: false,
		}),
	)
	.before(async (request) => {
		const data = await getInternal("foo", request);
		expectType<AssumedRoleCredentials>(data.foo);
	});
