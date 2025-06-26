import { AppConfigDataClient } from "@aws-sdk/client-appconfigdata";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import appConfig, { appConfigReq } from ".";

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
	setToContext: false,
} as const;

test("should use default options", () => {
	expect(appConfig()).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, LambdaContext>
	>();
});

test("should use with setToContext: false", () => {
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

test("should use with setToContext: true", () => {
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

// @ts-expect-error - fetchData must be an object
appConfig({ ...options, fetchData: "not-an-object" });

appConfig({
	...options,
	fetchData: {
		config: {
			// @ts-expect-error - Application must be a string
			ApplicationIdentifier: 123,
			// @ts-expect-error - Configuration must be a string
			ConfigurationProfileIdentifier: 123,
			// @ts-expect-error - Environment must be a string
			EnvironmentIdentifier: 123,
		},
	},
});

appConfig({
	...options,
	fetchData: {
		// @ts-expect-error - config must contain Application, ClientId, Configuration and Environment
		config: {},
	},
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("should return the correct config", () => {
	handler
		.use(
			appConfig({
				fetchData: {
					config: appConfigReq<{
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
});

test("should return the correct config using the getInternal method", () => {
	handler
		.use(
			appConfig({
				fetchData: {
					config: appConfigReq<{
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
});
