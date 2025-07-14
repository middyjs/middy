import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expectType } from "tsd";
import secretsManager, { type Context, secret } from "./index.js";

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>>>(
	secretsManager(),
);

const options = {
	AwsClient: SecretsManagerClient,
	awsClientOptions: {
		credentials: {
			secretAccessKey: "secret",
			sessionToken: "token",
			accessKeyId: "key",
		},
	},
	awsClientAssumeRole: "some-role",
	awsClientCapture: captureAWSv3Client,
	fetchData: { foo: "bar" },
	disablePrefetch: true,
	cacheKey: "some-key",
	cacheExpiry: 60 * 60 * 5,
	setToContext: true,
};

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<undefined>, {}>>(
	secretsManager(),
);

// use with all options
expectType<
	middy.MiddlewareObj<
		unknown,
		any,
		Error,
		Context<typeof options>,
		{ foo: unknown }
	>
>(secretsManager(options));

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

// setToContext: true
handler
	.use(
		secretsManager({
			...options,
			setToContext: true,
		}),
	)
	.before(async (request) => {
		expectType<unknown>(request.context.foo);

		const data = await getInternal("foo", request);
		expectType<unknown>(data.foo);
	});

// setToContext: false
handler
	.use(
		secretsManager({
			...options,
			setToContext: false,
		}),
	)
	.before(async (request) => {
		const data = await getInternal("foo", request);
		expectType<unknown>(data.foo);
	});

// setToContext: true, use return type hint function
handler
	.use(
		secretsManager({
			...options,
			fetchData: {
				someSecret: secret<{ User: string; Password: string }>(
					"someHiddenSecret",
				),
			},
			setToContext: true,
		}),
	)
	.before(async (request) => {
		expectType<{ User: string; Password: string }>(request.context.someSecret);

		const data = await getInternal("someSecret", request);
		expectType<{ User: string; Password: string }>(data.someSecret);
	});

// setToContext: false, use return type hint function
handler
	.use(
		secretsManager({
			...options,
			fetchData: {
				someSecret: secret<{ User: string; Password: string }>(
					"someHiddenSecret",
				),
			},
			setToContext: false,
		}),
	)
	.before(async (request) => {
		const data = await getInternal("someSecret", request);
		expectType<{ User: string; Password: string }>(data.someSecret);
	});
