import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import {
	AppConfigDataClient,
	GetLatestConfigurationCommand,
	StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
import appConfig from "./index.js";

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

const event = {};
const context = {
	getRemainingTimeInMillis: () => 1000,
};

const strToUintArray = (str) =>
	Uint8Array.from(str.split("").map((x) => x.charCodeAt()));

test("It should set AppConfigData param value to internal storage for multiple parameters", async (t) => {
	mockClient(AppConfigDataClient)
		.on(StartConfigurationSessionCommand, {
			ApplicationIdentifier: "app1",
			ConfigurationProfileIdentifier: "cpi1",
			EnvironmentIdentifier: "ei1",
		})
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "initialToken1",
		})
		.on(StartConfigurationSessionCommand, {
			ApplicationIdentifier: "app2",
			ConfigurationProfileIdentifier: "cpi2",
			EnvironmentIdentifier: "ei2",
		})
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "initialToken2",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "initialToken1",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option1":"value1"}'),
			NextPollConfigurationToken: "nextConfigToken",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "initialToken2",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option2":"value2"}'),
			NextPollConfigurationToken: "nextConfigToken2",
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key1?.option1, "value1");
		strictEqual(values.key2?.option2, "value2");
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 0,
				fetchData: {
					key1: {
						ApplicationIdentifier: "app1",
						ConfigurationProfileIdentifier: "cpi1",
						EnvironmentIdentifier: "ei1",
					},
					key2: {
						ApplicationIdentifier: "app2",
						ConfigurationProfileIdentifier: "cpi2",
						EnvironmentIdentifier: "ei2",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set AppConfigData param value to internal storage", async (t) => {
	const params = {
		ApplicationIdentifier: "...",
		ConfigurationProfileIdentifier: "...",
		EnvironmentIdentifier: "...",
	};
	mockClient(AppConfigDataClient)
		.on(StartConfigurationSessionCommand, params)
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "InitialToken...",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "nextConfigToken",
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 0,
				disablePrefetch: true,
				fetchData: {
					key: params,
				},
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should use previous configuration token on subsequent app config fetch", async (t) => {
	const params = {
		ApplicationIdentifier: "...",
		ConfigurationProfileIdentifier: "...",
		EnvironmentIdentifier: "...",
	};
	mockClient(AppConfigDataClient)
		.on(StartConfigurationSessionCommand, params)
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "InitialToken...",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "NextConfigToken",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "NextConfigToken",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"newValue"}'),
			NextPollConfigurationToken: "NextConfigToken",
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		return values.key?.option;
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 0,
				disablePrefetch: true,
				fetchData: {
					key: params,
				},
			}),
		)
		.before(middleware);

	const configOne = await handler(event, context);
	const configTwo = await handler(event, context);

	strictEqual(configOne, "value");
	strictEqual(configTwo, "newValue");
});

test("It should keep previous configuration value if getLatestConfiguration returns empty configuration array", async (t) => {
	mockClient(AppConfigDataClient)
		.on(StartConfigurationSessionCommand)
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "InitialToken...",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "NextConfigToken",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "NextConfigToken",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray(""),
			NextPollConfigurationToken: "NextConfigToken",
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		return values.key?.option;
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 0,
				disablePrefetch: true,
				fetchData: {
					key: {
						ApplicationIdentifier: "...",
						ConfigurationProfileIdentifier: "...",
						EnvironmentIdentifier: "...",
					},
				},
			}),
		)
		.before(middleware);

	const configOne = await handler(event, context);
	const configTwo = await handler(event, context);

	strictEqual(configOne, "value");
	strictEqual(configTwo, "value");
});

test("It should set AppConfig param value to internal storage without prefetch", async (t) => {
	mockClient(AppConfigDataClient)
		.on(StartConfigurationSessionCommand)
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "InitialToken...",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "nextConfigToken",
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 0,
				fetchData: {
					key: {
						ApplicationIdentifier: "...",
						ConfigurationProfileIdentifier: "...",
						EnvironmentIdentifier: "...",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set AppConfig param value to context", async (t) => {
	mockClient(AppConfigDataClient)
		.on(StartConfigurationSessionCommand)
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "InitialToken...",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "NextConfigToken",
		});

	const middleware = async (request) => {
		strictEqual(request.context.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 0,
				fetchData: {
					key: {
						ApplicationIdentifier: "...",
						ConfigurationProfileIdentifier: "...",
						EnvironmentIdentifier: "...",
					},
				},
				setToContext: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should not call aws-sdk again if parameter is cached forever", async (t) => {
	const mockService = mockClient(AppConfigDataClient);
	mockService
		.on(StartConfigurationSessionCommand)
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "InitialToken...",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "NextConfigToken",
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: -1,
				fetchData: {
					key: {
						ApplicationIdentifier: "...",
						ConfigurationProfileIdentifier: "...",
						EnvironmentIdentifier: "...",
					},
				},
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	strictEqual(mockService.send.callCount, 2);
});

test("It should not call aws-sdk again if parameter is cached", async (t) => {
	const mockService = mockClient(AppConfigDataClient);
	mockService
		.on(StartConfigurationSessionCommand)
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "InitialToken...",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "NextConfigToken",
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 1000,
				fetchData: {
					key: {
						ApplicationIdentifier: "...",
						ConfigurationProfileIdentifier: "...",
						EnvironmentIdentifier: "...",
					},
				},
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	strictEqual(mockService.send.callCount, 2);
});

test("It should call aws-sdk if cache enabled but cached param has expired", async (t) => {
	const mockService = mockClient(AppConfigDataClient);
	mockService
		.on(StartConfigurationSessionCommand)
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "InitialToken...",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "NextConfigToken",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "NextConfigToken",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"newValue"}'),
			NextPollConfigurationToken: "NextConfigToken",
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		return values.key?.option;
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 0,
				fetchData: {
					key: {
						ApplicationIdentifier: "...",
						ConfigurationProfileIdentifier: "...",
						EnvironmentIdentifier: "...",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	const configOne = await handler(event, context);
	const configTwo = await handler(event, context);

	strictEqual(configOne, "value");
	strictEqual(configTwo, "newValue");

	strictEqual(mockService.send.callCount, 3);
	ok(
		mockService.send.firstCall.firstArg instanceof
			StartConfigurationSessionCommand,
	);
	ok(
		mockService.send.secondCall.firstArg instanceof
			GetLatestConfigurationCommand,
	);
	ok(
		mockService.send.thirdCall.firstArg instanceof
			GetLatestConfigurationCommand,
	);
});

test("It should catch if an error is returned from fetch", async (t) => {
	const mockService = mockClient(AppConfigDataClient);
	mockService
		.on(StartConfigurationSessionCommand)
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "InitialToken...",
		})
		.rejects("timeout");

	const handler = middy(() => {}).use(
		appConfig({
			AwsClient: AppConfigDataClient,
			cacheExpiry: 0,
			fetchData: {
				key: {
					ApplicationIdentifier: "...",
					ConfigurationProfileIdentifier: "...",
					EnvironmentIdentifier: "...",
				},
			},
			setToContext: true,
			disablePrefetch: true,
		}),
	);

	try {
		await handler(event, context);
	} catch (e) {
		strictEqual(mockService.send.callCount, 2);
		strictEqual(e.message, "Failed to resolve internal values");
		deepStrictEqual(e.cause.data, [new Error("timeout")]);
	}
});

test("It should catch if an error is returned from start configuration session command", async (t) => {
	const mockService = mockClient(AppConfigDataClient);
	mockService.on(StartConfigurationSessionCommand).rejects("timeout");

	const handler = middy(() => {}).use(
		appConfig({
			AwsClient: AppConfigDataClient,
			cacheExpiry: 0,
			disablePrefetch: true,
			fetchData: {
				key: {
					ApplicationIdentifier: "...",
					ConfigurationProfileIdentifier: "...",
					EnvironmentIdentifier: "...",
				},
			},
			setToContext: true,
		}),
	);

	try {
		await handler(event, context);
	} catch (e) {
		strictEqual(mockService.send.callCount, 1);
		strictEqual(e.message, "Failed to resolve internal values");
		deepStrictEqual(e.cause.data, [new Error("timeout")]);
	}
});

test("Should not parse configuration is mime type is not application/json", async (t) => {
	const params = {
		ApplicationIdentifier: "xb0nby2",
		ConfigurationProfileIdentifier: "ofexqm2",
		EnvironmentIdentifier: "7tp0goq",
	};
	mockClient(AppConfigDataClient)
		.on(StartConfigurationSessionCommand, params)
		.resolvesOnce({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "InitialToken...",
		})
		.resolvesOnce({
			ContentType: "application/xml",
			Configuration: strToUintArray(
				'<?xml version="1.0" encoding="UTF-8" ?><option>value</option>',
			),
			NextPollConfigurationToken: "nextConfigToken",
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(
			values.key,
			'<?xml version="1.0" encoding="UTF-8" ?><option>value</option>',
		);
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 0,
				disablePrefetch: true,
				fetchData: {
					key: params,
				},
			}),
		)
		.before(middleware);

	await handler(event, context);
});
