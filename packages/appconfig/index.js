// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	AppConfigDataClient,
	GetLatestConfigurationCommand,
	StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import {
	awsClientOptionSchema,
	canPrefetch,
	catchInvalidSignatureException,
	createClient,
	createPrefetchClient,
	getCache,
	getInternal,
	jsonContentTypePattern,
	jsonSafeParse,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const defaults = {
	AwsClient: AppConfigDataClient,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {},
	disablePrefetch: false,
	cacheKey: "appconfig",
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
};

const optionSchema = { ...awsClientOptionSchema };

export const appConfigValidateOptions = (options) =>
	validateOptions("@middy/appconfig", optionSchema, options);
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

				let value = new TextDecoder().decode(configResp.Configuration);
				if (jsonContentTypePattern.test(configResp.ContentType)) {
					value = jsonSafeParse(value);
				}
				configurationCache[internalKey] = value;
				return value;
			})
			.catch((e) => {
				const value = getCache(options.cacheKey).value ?? {};
				value[internalKey] = undefined;
				modifyCache(options.cacheKey, value);
				throw e;
			});
	}

	const fetchDataKeys = Object.keys(options.fetchData);
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
	const appConfigMiddlewareBefore = async (request) => {
		if (!client) {
			clientInit ??= createClient(options, request);
			client = await clientInit;
		}
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (options.setToContext) {
			const data = await getInternal(fetchDataKeys, request);
			Object.assign(request.context, data);
		}
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
