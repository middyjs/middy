import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import {
	AppConfigDataClient,
	GetLatestConfigurationCommand,
	StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import { clearCache, getCache, getInternal } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import appConfig, { appConfigValidateOptions } from "./index.js";

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

const defaultEvent = {};
const defaultContext = {
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

	await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
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

	const configOne = await handler(defaultEvent, defaultContext);
	const configTwo = await handler(defaultEvent, defaultContext);

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

	const configOne = await handler(defaultEvent, defaultContext);
	const configTwo = await handler(defaultEvent, defaultContext);

	strictEqual(configOne, "value");
	strictEqual(configTwo, "value");
});

test("It should keep previous configuration value if getLatestConfiguration returns undefined Configuration (SDK >= 3.929.0)", async (t) => {
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
			Configuration: undefined,
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

	const configOne = await handler(defaultEvent, defaultContext);
	const configTwo = await handler(defaultEvent, defaultContext);

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

	await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

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

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

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

	const configOne = await handler(defaultEvent, defaultContext);
	const configTwo = await handler(defaultEvent, defaultContext);

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
		await handler(defaultEvent, defaultContext);
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
		await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
});

test("It should skip fetching already cached values when fetching multiple keys", async (t) => {
	let callCount = 0;
	const params1 = {
		Application: "MyApp",
		Environment: "MyEnv",
		Configuration: "MyConfig1",
	};
	const params2 = {
		Application: "MyApp",
		Environment: "MyEnv",
		Configuration: "MyConfig2",
	};

	const mockService = mockClient(AppConfigDataClient)
		.on(StartConfigurationSessionCommand)
		.callsFake(async (input) => {
			if (input.Configuration === "MyConfig1") {
				return { InitialConfigurationToken: "InitialToken1" };
			}
			return { InitialConfigurationToken: "InitialToken2" };
		})
		.on(GetLatestConfigurationCommand)
		.callsFake(async (input) => {
			callCount++;
			// First call for config1 succeeds
			if (callCount === 1 && input.ConfigurationToken === "InitialToken1") {
				return {
					ContentType: "application/json",
					Configuration: strToUintArray('{"option":"value1"}'),
					NextPollConfigurationToken: "NextToken1",
				};
			}
			// Second call for config2 fails
			if (callCount === 2 && input.ConfigurationToken === "InitialToken2") {
				throw new Error("timeout");
			}
			// Third call only fetches config2 (config1 is cached)
			if (callCount === 3 && input.ConfigurationToken === "InitialToken2") {
				return {
					ContentType: "application/json",
					Configuration: strToUintArray('{"option":"value2"}'),
					NextPollConfigurationToken: "NextToken2",
				};
			}
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key1?.option, "value1");
		strictEqual(values.key2?.option, "value2");
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 1000,
				fetchData: {
					key1: params1,
					key2: params2,
				},
			}),
		)
		.before(middleware);

	// First call - key1 succeeds, key2 fails
	try {
		await handler(defaultEvent, defaultContext);
	} catch (_e) {
		// Expected to fail
	}

	// Second call - only key2 is fetched (key1 is already cached)
	await handler(defaultEvent, defaultContext);

	// Should have called send 6 times (2 StartSession + 3 GetLatest initial + 1 GetLatest for cached config1)
	strictEqual(sendStub.callCount, 6);
});

test("It should handle GetLatestConfiguration error with cache enabled", async (t) => {
	mockClient(AppConfigDataClient)
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
			cacheExpiry: -1,
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
		await handler(defaultEvent, defaultContext);
	} catch (e) {
		strictEqual(e.message, "Failed to resolve internal values");
	}
});

test("It should correctly decode configuration across multiple fetches with a reused decoder", async (t) => {
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
			Configuration: strToUintArray('{"option":"first"}'),
			NextPollConfigurationToken: "NextConfigToken",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "NextConfigToken",
		})
		.resolvesOnce({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"second"}'),
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

	const configOne = await handler(defaultEvent, defaultContext);
	const configTwo = await handler(defaultEvent, defaultContext);

	strictEqual(configOne, "first");
	strictEqual(configTwo, "second");
});

test("It should export appConfigParam helper for TypeScript type inference", async (t) => {
	const { appConfigParam } = await import("./index.js");
	const mockRequest = { event: {}, context: {}, internal: {} };
	const result = appConfigParam(mockRequest);
	strictEqual(result, mockRequest);
});

test("appConfigValidateOptions accepts valid options", () => {
	appConfigValidateOptions({ cacheKey: "x", cacheExpiry: 0 });
	appConfigValidateOptions({});
});

test("appConfigValidateOptions rejects unknown key with correct cause.package", () => {
	try {
		appConfigValidateOptions({ cachExpiry: 60 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("cachExpiry"));
		strictEqual(e.cause.package, "@middy/appconfig");
	}
});

test("appConfigValidateOptions rejects wrong type", () => {
	try {
		appConfigValidateOptions({ fetchData: "no" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("fetchData"));
	}
});

test("appConfigValidateOptions accepts RequiredMinimumPollIntervalInSeconds", () => {
	appConfigValidateOptions({
		fetchData: {
			key: {
				ApplicationIdentifier: "a",
				ConfigurationProfileIdentifier: "c",
				EnvironmentIdentifier: "e",
				RequiredMinimumPollIntervalInSeconds: 30,
			},
		},
	});
});

test("appConfigValidateOptions rejects RequiredMinimumPollIntervalInSeconds below minimum", () => {
	try {
		appConfigValidateOptions({
			fetchData: {
				key: {
					ApplicationIdentifier: "a",
					ConfigurationProfileIdentifier: "c",
					EnvironmentIdentifier: "e",
					RequiredMinimumPollIntervalInSeconds: 5,
				},
			},
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("RequiredMinimumPollIntervalInSeconds"));
	}
});

test("appConfigValidateOptions rejects fetchData entry missing required identifiers", () => {
	try {
		appConfigValidateOptions({
			fetchData: {
				key: { ApplicationIdentifier: "a" },
			},
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("ConfigurationProfileIdentifier"));
	}
});

// --- optionSchema property-rule coverage ---
// Each of these passes a *valid* value for one property. The real schema rule
// accepts it (no throw); any mutated rule (empty object {} or empty string ""
// for the type/instanceof tag) turns the rule into an invalid schema and makes
// validateOptions throw, so "accepts valid value" pins the rule shape.

test("appConfigValidateOptions accepts a Function AwsClient (pins AwsClient rule)", () => {
	appConfigValidateOptions({ AwsClient: AppConfigDataClient });
});

test("appConfigValidateOptions rejects non-Function AwsClient", () => {
	try {
		appConfigValidateOptions({ AwsClient: "nope" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("AwsClient"));
	}
});

test("appConfigValidateOptions accepts object awsClientOptions (pins awsClientOptions rule)", () => {
	appConfigValidateOptions({ awsClientOptions: { region: "us-east-1" } });
});

test("appConfigValidateOptions rejects non-object awsClientOptions", () => {
	try {
		appConfigValidateOptions({ awsClientOptions: "nope" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("awsClientOptions"));
	}
});

test("appConfigValidateOptions accepts string awsClientAssumeRole (pins awsClientAssumeRole rule)", () => {
	appConfigValidateOptions({ awsClientAssumeRole: "role" });
});

test("appConfigValidateOptions rejects non-string awsClientAssumeRole", () => {
	try {
		appConfigValidateOptions({ awsClientAssumeRole: 123 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("awsClientAssumeRole"));
	}
});

test("appConfigValidateOptions accepts a Function awsClientCapture (pins awsClientCapture rule)", () => {
	appConfigValidateOptions({ awsClientCapture: () => {} });
});

test("appConfigValidateOptions rejects non-Function awsClientCapture", () => {
	try {
		appConfigValidateOptions({ awsClientCapture: "nope" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("awsClientCapture"));
	}
});

test("appConfigValidateOptions accepts boolean disablePrefetch (pins disablePrefetch rule)", () => {
	appConfigValidateOptions({ disablePrefetch: true });
});

test("appConfigValidateOptions rejects non-boolean disablePrefetch", () => {
	try {
		appConfigValidateOptions({ disablePrefetch: "yes" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("disablePrefetch"));
	}
});

test("appConfigValidateOptions accepts string cacheKey (pins cacheKey rule)", () => {
	appConfigValidateOptions({ cacheKey: "myKey" });
});

test("appConfigValidateOptions rejects non-string cacheKey", () => {
	try {
		appConfigValidateOptions({ cacheKey: 123 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("cacheKey"));
	}
});

test("appConfigValidateOptions accepts object cacheKeyExpiry with numeric values (pins cacheKeyExpiry rule)", () => {
	appConfigValidateOptions({ cacheKeyExpiry: { "@middy/appconfig": 1000 } });
});

test("appConfigValidateOptions accepts cacheKeyExpiry value of -1 (pins minimum -1)", () => {
	// minimum is -1; a value of -1 must pass. If the minimum were mutated to
	// +1 this would throw.
	appConfigValidateOptions({ cacheKeyExpiry: { "@middy/appconfig": -1 } });
});

test("appConfigValidateOptions rejects cacheKeyExpiry value below -1", () => {
	try {
		appConfigValidateOptions({ cacheKeyExpiry: { "@middy/appconfig": -2 } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("@middy/appconfig"));
	}
});

test("appConfigValidateOptions rejects non-number cacheKeyExpiry value", () => {
	try {
		appConfigValidateOptions({
			cacheKeyExpiry: { "@middy/appconfig": "soon" },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("@middy/appconfig"));
	}
});

test("appConfigValidateOptions rejects non-object cacheKeyExpiry", () => {
	try {
		appConfigValidateOptions({ cacheKeyExpiry: "nope" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("cacheKeyExpiry"));
	}
});

test("appConfigValidateOptions accepts boolean setToContext (pins setToContext rule)", () => {
	appConfigValidateOptions({ setToContext: true });
});

test("appConfigValidateOptions rejects non-boolean setToContext", () => {
	try {
		appConfigValidateOptions({ setToContext: "yes" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("setToContext"));
	}
});

test("appConfigValidateOptions accepts extra properties on a fetchData entry (pins additionalProperties true)", () => {
	// fetchData entries set additionalProperties:true, so unknown extra keys
	// (passed through to StartConfigurationSession) must be accepted. A mutation
	// to additionalProperties:false would reject this.
	appConfigValidateOptions({
		fetchData: {
			key: {
				ApplicationIdentifier: "a",
				ConfigurationProfileIdentifier: "c",
				EnvironmentIdentifier: "e",
				SomeFutureSdkField: "x",
			},
		},
	});
});

// --- runtime behaviour ---

test("It should NOT parse a JSON-looking body when ContentType is not application/json", async (t) => {
	// Pins the `if (jsonContentTypePattern.test(ContentType))` branch on line
	// 107: with a non-JSON content type the raw string must be kept. If the
	// condition were forced true the body would be JSON.parsed into an object.
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
			ContentType: "text/plain",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "nextConfigToken",
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, '{"option":"value"}');
		strictEqual(typeof values.key, "string");
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 0,
				disablePrefetch: true,
				fetchData: { key: params },
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should rethrow when StartConfigurationSession rejects (catch handler rethrows)", async (t) => {
	// Pins the catch block on lines 140-145: it must set the cache slot to
	// undefined and rethrow. If the block body were emptied the rejection would
	// be swallowed and the handler would resolve normally.
	const mockService = mockClient(AppConfigDataClient);
	mockService.on(StartConfigurationSessionCommand).rejects("timeout");

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
		// A consumer that awaits the resolved internal values; this forces the
		// rejected fetch promise to be observed so the catch's rethrow surfaces.
		.before(async (request) => {
			await getInternal(true, request);
		});

	await rejects(
		() => handler(defaultEvent, defaultContext),
		(e) => {
			strictEqual(e.message, "Failed to resolve internal values");
			deepStrictEqual(e.cause.data, [new Error("timeout")]);
			return true;
		},
	);
});

test("It should rethrow when GetLatestConfiguration rejects (catch handler rethrows)", async (t) => {
	// Pins the inner catch on lines 113-118 / outer 140-145: the rejection must
	// propagate. Asserts an actual throw (not a vacuous try/catch).
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
		.before(async (request) => {
			await getInternal(true, request);
		});

	await rejects(() => handler(defaultEvent, defaultContext));
});

test("It defaults cacheExpiry to -1 (cache forever) when omitted", async (t) => {
	// Pins defaults.cacheExpiry === -1 (line 37). With -1 processCache stores an
	// infinite expiry; if the default were mutated to +1 the stored expiry would
	// be finite (now + 1ms).
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

	const handler = middy(() => {}).use(
		appConfig({
			AwsClient: AppConfigDataClient,
			// cacheExpiry omitted -> default -1
			disablePrefetch: true,
			fetchData: {
				key: {
					ApplicationIdentifier: "...",
					ConfigurationProfileIdentifier: "...",
					EnvironmentIdentifier: "...",
				},
			},
		}),
	);

	await handler(defaultEvent, defaultContext);

	strictEqual(getCache("@middy/appconfig").expiry, Number.POSITIVE_INFINITY);
});

test("It defaults setToContext to false when omitted (value not copied to context)", async (t) => {
	// Pins defaults.setToContext === false (line 38). When omitted the resolved
	// value must NOT be written onto request.context.
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
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
		// setToContext defaults to false -> nothing copied to context
		strictEqual(request.context.key, undefined);
	};

	const handler = middy(() => {})
		.use(
			appConfig({
				AwsClient: AppConfigDataClient,
				cacheExpiry: 0,
				// setToContext omitted -> default false
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

	// Fresh context so a sibling test that uses setToContext:true cannot leak
	// `context.key` into this assertion via the shared defaultContext object.
	await handler(defaultEvent, { getRemainingTimeInMillis: () => 1000 });
});

test("It prefetches at construction when disablePrefetch defaults to false", async (t) => {
	// Pins defaults.disablePrefetch === false (line 34) AND the prefetch branch
	// (line 158): with prefetch enabled the AWS client is created and the fetch
	// fires during appConfig() construction, before the handler is invoked.
	const mockService = mockClient(AppConfigDataClient);
	mockService
		.on(StartConfigurationSessionCommand)
		.resolves({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand)
		.resolves({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "NextConfigToken",
		});

	const middleware = appConfig({
		AwsClient: AppConfigDataClient,
		cacheExpiry: 1000,
		// disablePrefetch omitted -> default false -> prefetch happens now
		fetchData: {
			key: {
				ApplicationIdentifier: "...",
				ConfigurationProfileIdentifier: "...",
				EnvironmentIdentifier: "...",
			},
		},
	});

	// The StartConfigurationSession command was issued during construction,
	// before any handler invocation.
	ok(mockService.send.callCount >= 1);
	ok(
		mockService.send.firstCall.firstArg instanceof
			StartConfigurationSessionCommand,
	);

	const handler = middy(() => {}).use(middleware);
	await handler(defaultEvent, defaultContext);
});

test("It does NOT prefetch at construction when disablePrefetch is true", async (t) => {
	// Pins the prefetch branch (line 158) in the other direction: with
	// disablePrefetch:true no AWS call is made until the handler runs.
	const mockService = mockClient(AppConfigDataClient);
	mockService
		.on(StartConfigurationSessionCommand)
		.resolves({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand)
		.resolves({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "NextConfigToken",
		});

	const handler = middy(() => {}).use(
		appConfig({
			AwsClient: AppConfigDataClient,
			cacheExpiry: 1000,
			disablePrefetch: true,
			fetchData: {
				key: {
					ApplicationIdentifier: "...",
					ConfigurationProfileIdentifier: "...",
					EnvironmentIdentifier: "...",
				},
			},
		}),
	);

	strictEqual(mockService.send.callCount, 0);
	await handler(defaultEvent, defaultContext);
	ok(mockService.send.callCount > 0);
});

test("It reuses the prefetched client instead of creating a new one in before", async (t) => {
	// Pins `if (!client)` on line 163: after prefetch, client is already set, so
	// the before-handler must NOT create another client. Counting AwsClient
	// instantiations detects a forced-true mutation (which would build a 2nd).
	mockClient(AppConfigDataClient)
		.on(StartConfigurationSessionCommand)
		.resolves({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand)
		.resolves({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "NextConfigToken",
		});

	let instances = 0;
	class CountingClient extends AppConfigDataClient {
		constructor(...args) {
			super(...args);
			instances++;
		}
	}

	const handler = middy(() => {}).use(
		appConfig({
			AwsClient: CountingClient,
			cacheExpiry: 1000,
			// prefetch enabled -> client built once at construction
			fetchData: {
				key: {
					ApplicationIdentifier: "...",
					ConfigurationProfileIdentifier: "...",
					EnvironmentIdentifier: "...",
				},
			},
		}),
	);

	strictEqual(instances, 1);
	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);
	strictEqual(instances, 1);
});
