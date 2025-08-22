import { Signer } from "@aws-sdk/rds-signer";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { expect } from "tstyche";
import rdsSigner from "./index.js";

// use with default options
const middleware = rdsSigner();
expect(middleware).type.toBe<middy.MiddlewareObj>();

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
expect(rdsSigner()).type.toBe<middy.MiddlewareObj>();

// use with all options
expect(rdsSigner(options)).type.toBe<
	middy.MiddlewareObj<unknown, any, Error, LambdaContext, { foo: string }>
>();

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
		expect(request.context.foo).type.toBe<string>();

		const data = await getInternal("foo", request);
		expect(data.foo).type.toBe<string>();
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
		expect(data.foo).type.toBe<string>();
	});
