// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	AppConfigDataClient,
	GetLatestConfigurationCommand,
	StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import {
	assignSetToContext,
	awsClientOptionsSchema,
	buildSetToContextSpec,
	cacheOptionSchemaProperties,
	canPrefetch,
	catchInvalidSignatureException,
	createClientInit,
	createPrefetchClient,
	evictCacheOnFailure,
	jsonContentTypePattern,
	jsonSafeParse,
	processCache,
	reservedPropertyNames,
	setCacheKeyExpiry,
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

const keyNameRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};
// "Length Constraints: Minimum length of 1. Maximum length of 128."
// https://docs.aws.amazon.com/appconfig/2019-10-09/APIReference/API_appconfigdata_StartConfigurationSession.html
const identifierRule = {
	type: "string",
	maxLength: 128,
	pattern: /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:appconfig:options",
	$defs: { Function: false, Object: false },
	type: "object",
	properties: {
		AwsClient: { $ref: "#/$defs/Function" },
		awsClientOptions: awsClientOptionsSchema,
		awsClientAssumeRole: keyNameRule,
		awsClientCapture: { $ref: "#/$defs/Function" },
		fetchData: {
			type: "object",
			propertyNames: keyNameRule,
			maxProperties: 1024,
			required: [],
			additionalProperties: {
				type: "object",
				properties: {
					ApplicationIdentifier: identifierRule,
					ConfigurationProfileIdentifier: identifierRule,
					EnvironmentIdentifier: identifierRule,
					// "Valid Range: Minimum value of 15. Maximum value of 86400."
					RequiredMinimumPollIntervalInSeconds: {
						type: "integer",
						minimum: 15,
						maximum: 86400,
					},
				},
				required: [
					"ApplicationIdentifier",
					"ConfigurationProfileIdentifier",
					"EnvironmentIdentifier",
				],
				additionalProperties: false,
				unevaluatedProperties: false,
			},
			unevaluatedProperties: false,
		},
		...cacheOptionSchemaProperties,
		setToContext: { type: "boolean" },
		contextKey: keyNameRule,
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
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
				const now = Date.now();
				configurationTokenCache[internalKey] = {
					token: configResp.NextPollConfigurationToken,
					expiry: now + tokenValidityMs,
					// NextPollIntervalInSeconds is "the amount of time the client
					// should wait before polling for configuration updates again".
					// https://docs.aws.amazon.com/appconfig/2019-10-09/APIReference/API_appconfigdata_GetLatestConfiguration.html
					nextPollAt: now + (configResp.NextPollIntervalInSeconds ?? 0) * 1000,
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
		const now = Date.now();
		if (typeof cachedToken === "undefined" || cachedToken.expiry <= now) {
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
		// A session started with RequiredMinimumPollIntervalInSeconds "can't call
		// GetLatestConfiguration more frequently" than that.
		// https://docs.aws.amazon.com/appconfig/2019-10-09/APIReference/API_appconfigdata_StartConfigurationSession.html
		if (now < cachedToken.nextPollAt) {
			setCacheKeyExpiry(options, cachedToken.nextPollAt);
			return Promise.resolve(configurationCache[internalKey]);
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
