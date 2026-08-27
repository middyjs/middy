// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	AppConfigDataClient,
	GetLatestConfigurationCommand,
	StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	catchInvalidSignatureException,
	createClient,
	createPrefetchClient,
	getCache,
	jsonContentTypePattern,
	jsonSafeParse,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "appconfig";
const pkg = `@middy/${name}`;

const decoder = new TextDecoder();

const defaults = {
	AwsClient: AppConfigDataClient,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {},
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
	contextKey: name,
};

const optionSchema = {
	type: "object",
	properties: {
		AwsClient: { instanceof: "Function" },
		awsClientOptions: { type: "object" },
		awsClientAssumeRole: { type: "string" },
		awsClientCapture: { instanceof: "Function" },
		fetchData: {
			type: "object",
			additionalProperties: {
				type: "object",
				required: [
					"ApplicationIdentifier",
					"ConfigurationProfileIdentifier",
					"EnvironmentIdentifier",
				],
				properties: {
					ApplicationIdentifier: { type: "string" },
					ConfigurationProfileIdentifier: { type: "string" },
					EnvironmentIdentifier: { type: "string" },
					RequiredMinimumPollIntervalInSeconds: {
						type: "number",
						minimum: 15,
					},
				},
				additionalProperties: true,
			},
		},
		disablePrefetch: { type: "boolean" },
		cacheKey: { type: "string" },
		cacheKeyExpiry: {
			type: "object",
			additionalProperties: { type: "number", minimum: -1 },
		},
		cacheExpiry: { type: "number", minimum: -1 },
		setToContext: { type: "boolean" },
		contextKey: { type: "string" },
	},
	additionalProperties: false,
};

export const appConfigValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);
const appConfigMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
	};
	const configurationTokenCache = Object.create(null);
	const configurationCache = Object.create(null);

	function fetchLatestConfigurationRequest(configToken, internalKey) {
		const command = new GetLatestConfigurationCommand({
			ConfigurationToken: configToken,
		});
		return client
			.send(command)
			.catch((e) => catchInvalidSignatureException(e, client, command))
			.then((configResp) => {
				configurationTokenCache[internalKey] =
					configResp.NextPollConfigurationToken;

				if (!configResp.Configuration?.length) {
					return configurationCache[internalKey];
				}

				let value = decoder.decode(configResp.Configuration);
				if (jsonContentTypePattern.test(configResp.ContentType)) {
					value = jsonSafeParse(value);
				}
				configurationCache[internalKey] = value;
				return value;
			})
			.catch((e) => {
				// Copy rather than mutate the cached object in place, matching the
				// session-command catch below: the cache must be updated through
				// `modifyCache` so the refresh timer is rescheduled with it.
				const value = { ...getCache(options.cacheKey).value };
				value[internalKey] = undefined;
				modifyCache(options.cacheKey, value);
				throw e;
			});
	}

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			if (typeof configurationTokenCache[internalKey] === "undefined") {
				const command = new StartConfigurationSessionCommand(
					options.fetchData[internalKey],
				);
				values[internalKey] = client
					.send(command)
					.catch((e) => catchInvalidSignatureException(e, client, command))
					.then((configSessionResp) =>
						fetchLatestConfigurationRequest(
							configSessionResp.InitialConfigurationToken,
							internalKey,
						),
					)
					.catch((e) => {
						const value = { ...getCache(options.cacheKey).value };
						value[internalKey] = undefined;
						modifyCache(options.cacheKey, value);
						throw e;
					});

				continue;
			}
			values[internalKey] = fetchLatestConfigurationRequest(
				configurationTokenCache[internalKey],
				internalKey,
			);
		}
		return values;
	};
	let client;
	let clientInit;
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}
	const appConfigMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const appConfigMiddlewareBefore = (request) => {
		if (client) return appConfigMiddlewareFetch(request);
		clientInit ??= createClient(options, request);
		return clientInit.then((resolvedClient) => {
			client = resolvedClient;
			return appConfigMiddlewareFetch(request);
		});
	};
	return {
		before: appConfigMiddlewareBefore,
	};
};
export default appConfigMiddleware;

// used for TS type inference (see index.d.ts)
export function appConfigParam(name) {
	return name;
}
