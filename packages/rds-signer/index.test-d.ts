import { Signer } from "@aws-sdk/rds-signer";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { expectType } from "tsd";
import rdsSigner from ".";

// use with default options
const middleware = rdsSigner();
expectType<middy.MiddlewareObj>(middleware);

const options = {
	AwsClient: Signer,
	awsClientOptions: {
		credentials: {
			secretAccessKey: "secret",
			accessKeyId: "key",
		},
	},
	awsClientAssumeRole: "some-role",
	fetchData: {
		foo: {
			region: "ca-central-1",
			hostname: "***.rds.amazonaws.com",
			username: "iam_role",
			port: 5432,
		},
	},
	disablePrefetch: true,
	cacheKey: "some-key",
	cacheExpiry: 60 * 60 * 5,
	setToContext: true,
};

// use with no options
expectType<middy.MiddlewareObj>(rdsSigner());

// use with all options
expectType<
	middy.MiddlewareObj<unknown, any, Error, LambdaContext, { foo: string }>
>(rdsSigner(options));

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

// use with setToContext: true
handler
	.use(
		rdsSigner({
			...options,
			setToContext: true,
		}),
	)
	.before(async (request) => {
		expectType<string>(request.context.foo);

		const data = await getInternal("foo", request);
		expectType<string>(data.foo);
	});

// use with setToContext: false
handler
	.use(
		rdsSigner({
			...options,
			setToContext: false,
		}),
	)
	.before(async (request) => {
		const data = await getInternal("foo", request);
		expectType<string>(data.foo);
	});
