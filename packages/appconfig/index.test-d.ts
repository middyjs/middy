import { AppConfigDataClient } from "@aws-sdk/client-appconfigdata";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expectType } from "tsd";
import appConfig, { appConfigReq, type Context } from "./index.js";

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

// use with default options
expectType<middy.MiddlewareObj<unknown, any, Error, LambdaContext>>(
	appConfig(),
);

// use with all options
expectType<middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>>(
	appConfig(options),
);

// use with setToContext: false
expectType<
	middy.MiddlewareObj<
		unknown,
		any,
		Error,
		LambdaContext,
		Record<"config", unknown>
	>
>(
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
);

// use with setToContext: true
expectType<
	middy.MiddlewareObj<
		unknown,
		any,
		Error,
		LambdaContext & Record<"config", unknown>,
		Record<"config", unknown>
	>
>(
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
);

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
		expectType<{ config1: string; config2: string; config3: number }>(
			request.context.config,
		);

		const data = await getInternal("config", request);
		expectType<string>(data.config.config1);
	});

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
		expectType<{ config1: string; config2: string; config3: number }>(
			data.config,
		);
	});
