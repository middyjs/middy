import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import secretsManager, { type Context, secretsManagerParam } from "./index.js";

test("use with default options", () => {
	expect(secretsManager()).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, Context<undefined>>
	>();
});

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

test("use with all options", () => {
	expect(secretsManager(options)).type.toBe<
		middy.MiddlewareObj<
			unknown,
			any,
			Error,
			Context<typeof options>,
			{ foo: unknown }
		>
	>();
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("setToContext: true", () => {
	handler
		.use(
			secretsManager({
				...options,
				setToContext: true,
			}),
		)
		.before(async (request) => {
			expect(request.context.foo).type.toBe<unknown>();

			const data = await getInternal("foo", request);
			expect(data.foo).type.toBe<unknown>();
		});
});

test("setToContext: false", () => {
	handler
		.use(
			secretsManager({
				...options,
				setToContext: false,
			}),
		)
		.before(async (request) => {
			const data = await getInternal("foo", request);
			expect(data.foo).type.toBe<unknown>();
		});
});

test("setToContext: true, use return type hint function", () => {
	handler
		.use(
			secretsManager({
				...options,
				fetchData: {
					someSecret: secretsManagerParam<{ User: string; Password: string }>(
						"someHiddenSecret",
					),
				},
				setToContext: true,
			}),
		)
		.before(async (request) => {
			expect(request.context.someSecret).type.toBe<{
				User: string;
				Password: string;
			}>();

			const data = await getInternal("someSecret", request);
			expect(data.someSecret).type.toBe<{ User: string; Password: string }>();
		});
});

test("setToContext: false, use return type hint function", () => {
	handler
		.use(
			secretsManager({
				...options,
				fetchData: {
					someSecret: secretsManagerParam<{ User: string; Password: string }>(
						"someHiddenSecret",
					),
				},
				setToContext: false,
			}),
		)
		.before(async (request) => {
			const data = await getInternal("someSecret", request);
			expect(data.someSecret).type.toBe<{ User: string; Password: string }>();
		});
});
