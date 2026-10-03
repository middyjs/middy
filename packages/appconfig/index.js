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
	createClientInit,
	createPrefetchClient,
	evictCacheOnFailure,
	jsonContentTypePattern,
	jsonSafeParse,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "appconfig";
const pkg = `@middy/${name}`;

const decoder = new TextDecoder();

// Configuration tokens are "valid for up to 24 hours"; an expired one is a
// BadRequestException. Age is counted from receipt, so the margin covers the
// time the token spent in transit before it was stored and the next call's
// own transit and SDK retries before it reaches the service.
// https://docs.aws.amazon.com/appconfig/2019-10-09/APIReference/API_appconfigdata_GetLatestConfiguration.html
const tokenValidityMs = 24 * 60 * 60 * 1000 - 5 * 60 * 1000;

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
						maximum: Number.MAX_SAFE_INTEGER,
					},
				},
				additionalProperties: true,
			},
		},
		disablePrefetch: { type: "boolean" },
		cacheKey: { type: "string" },
		cacheKeyExpiry: {
			type: "object",
			additionalProperties: {
				type: "number",
				minimum: -1,
				maximum: Number.MAX_SAFE_INTEGER,
			},
		},
		cacheExpiry: {
			type: "number",
			minimum: -1,
			maximum: Number.MAX_SAFE_INTEGER,
		},
		cacheMaxSize: {
			type: "integer",
			minimum: 1,
			maximum: Number.MAX_SAFE_INTEGER,
		},
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
				configurationTokenCache[internalKey] = {
					token: configResp.NextPollConfigurationToken,
					expiry: Date.now() + tokenValidityMs,
				};

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
				// Tokens are single-use and expire after 24 hours, so the one just
				// used cannot be retried; the next fetch starts a new session.
				configurationTokenCache[internalKey] = undefined;
				throw e;
			});
	}

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
	const fetchConfigurationRequest = (internalKey) => {
		const cachedToken = configurationTokenCache[internalKey];
		if (
			typeof cachedToken === "undefined" ||
			cachedToken.expiry <= Date.now()
		) {
			const command = new StartConfigurationSessionCommand(
				options.fetchData[internalKey],
			);
			return client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then((configSessionResp) =>
					fetchLatestConfigurationRequest(
						configSessionResp.InitialConfigurationToken,
						internalKey,
					),
				);
		}
		return fetchLatestConfigurationRequest(cachedToken.token, internalKey);
	};

	// A configuration token is single-use, so concurrent invocations share the
	// in-flight fetch instead of each spending the same token.
	const inflight = Object.create(null);
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			inflight[internalKey] ??= fetchConfigurationRequest(internalKey).finally(
				() => {
					inflight[internalKey] = undefined;
				},
			);
			// Each caller evicts only its own promise, so a shared fetch failing
			// after a newer cycle replaced the entry leaves the fresh value.
			values[internalKey] = inflight[internalKey].catch(
				evictCacheOnFailure(options.cacheKey, internalKey, values),
			);
		}
		return values;
	};
	let client;
	const clientInit = createClientInit(options);
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
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation.
		if (client && !options.awsClientAssumeRole) {
			return appConfigMiddlewareFetch(request);
		}
		return clientInit(request).then((resolvedClient) => {
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
