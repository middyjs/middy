// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	AppConfigDataClient,
	GetLatestConfigurationCommand,
	StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import {
	canPrefetch,
	catchInvalidSignatureException,
	createClient,
	createPrefetchClient,
	getCache,
	getInternal,
	jsonSafeParse,
	modifyCache,
	processCache,
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
const contentTypePattern = /^application\/(.+\+)?json($|;.+)/;
const appConfigMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
	};
	const configurationTokenCache = {};
	const configurationCache = {};

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

				if (configResp.Configuration.length === 0) {
					return configurationCache[internalKey];
				}

				let value = new TextDecoder().decode(configResp.Configuration);
				if (contentTypePattern.test(configResp.ContentType)) {
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

	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of Object.keys(options.fetchData)) {
			if (cachedValues[internalKey]) continue;
			if (configurationTokenCache[internalKey] == null) {
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
						const value = getCache(options.cacheKey).value ?? {};
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
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}
	const appConfigMiddlewareBefore = async (request) => {
		if (!client) {
			client = await createClient(options, request);
		}
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (options.setToContext) {
			const data = await getInternal(Object.keys(options.fetchData), request);
			Object.assign(request.context, data);
		}
	};
	return {
		before: appConfigMiddlewareBefore,
	};
};
export default appConfigMiddleware;

// used for TS type inference (see index.d.ts)
export function appConfigReq(req) {
	return req;
}

// # sourceMappingURL=index.js.map
