import { AppConfigDataClient } from "@aws-sdk/client-appconfigdata";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import appConfig, { appConfigParam, type Context } from "./index.js";

const options = {
	AwsClient: AppConfigDataClient,
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
	cacheKey: "some-key",
	cacheExpiry: 60 * 60 * 5,
	cacheKeyExpiry: {},
	setToContext: false,
};

test("use with default options", () => {
	expect(appConfig()).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, LambdaContext>
	>();
});

test("use with all options", () => {
	expect(appConfig(options)).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>
	>();
});

test("use with setToContext: false", () => {
	expect(
		appConfig({
			...options,
			fetchData: {
				config: {
					ApplicationIdentifier: "app",
					ConfigurationProfileIdentifier: "configId",
					EnvironmentIdentifier: "development",
				},
			},
			setToContext: false,
		}),
	).type.toBe<
		middy.MiddlewareObj<
			unknown,
			any,
			Error,
			LambdaContext,
			Record<"config", unknown>
		>
	>();
});

test("use with setToContext: true", () => {
	expect(
		appConfig({
			...options,
			fetchData: {
				config: {
					ApplicationIdentifier: "app",
					ConfigurationProfileIdentifier: "configId",
					EnvironmentIdentifier: "development",
				},
			},
			setToContext: true,
		}),
	).type.toBe<
		middy.MiddlewareObj<
			unknown,
			any,
			Error,
			LambdaContext & Record<"config", unknown>,
			Record<"config", unknown>
		>
	>();
});

expect(appConfig).type.not.toBeCallableWith({
	...options,
	fetchData: "not-an-object", // fetchData must be an object
});

expect(appConfig).type.not.toBeCallableWith({
	...options,
	fetchData: {
		config: {
			ApplicationIdentifier: 123, // Application must be a string
			ConfigurationProfileIdentifier: 123, // Configuration must be a string
			EnvironmentIdentifier: 123, // Environment must be a string
		},
	},
});

expect(appConfig).type.not.toBeCallableWith({
	...options,
	fetchData: {
		config: {}, // config must contain Application, ClientId, Configuration and Environment
	},
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

handler
	.use(
		appConfig({
			fetchData: {
				config: appConfigParam<{
					config1: string;
					config2: string;
					config3: number;
				}>({
					ApplicationIdentifier: "app",
					ConfigurationProfileIdentifier: "configId",
					EnvironmentIdentifier: "development",
				}),
			},
			setToContext: true,
		}),
	)
	.before(async (request) => {
		expect(request.context.config).type.toBe<{
			config1: string;
			config2: string;
			config3: number;
		}>();

		const data = await getInternal("config", request);
		expect(data.config.config1).type.toBe<string>();
	});

handler
	.use(
		appConfig({
			fetchData: {
				config: appConfigParam<{
					config1: string;
					config2: string;
					config3: number;
				}>({
					ApplicationIdentifier: "app",
					ConfigurationProfileIdentifier: "configId",
					EnvironmentIdentifier: "development",
				}),
			},
			setToContext: false,
		}),
	)
	.before(async (request) => {
		const data = await getInternal("config", request);
		expect(data.config).type.toBe<{
			config1: string;
			config2: string;
			config3: number;
		}>();
	});
