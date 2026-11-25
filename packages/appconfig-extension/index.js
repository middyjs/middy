// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	assignSetToContext,
	buildSetToContextSpec,
	cacheOptionSchemaProperties,
	canPrefetch,
	evictCacheOnFailure,
	jsonContentTypePattern,
	processCache,
	reservedPropertyNames,
	validateOptions,
} from "@middy/util";

const name = "appconfig-extension";
const pkg = `@middy/${name}`;

const defaults = {
	fetchData: {},
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	// The extension is the cache: it "maintains a local cache of the
	// configuration data" and "periodically checks for updates to your
	// configuration data in the background". It is asked on every invocation
	// so the function sees a newly deployed configuration, instead of keeping
	// the first one for good.
	// https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-integration-lambda-extensions-how-it-works.html
	cacheExpiry: 0,
	setToContext: false,
	contextKey: name,
};

const keyNameRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};
// The extension starts a configuration session with these identifiers:
// "Length Constraints: Minimum length of 1. Maximum length of 128."
// https://docs.aws.amazon.com/appconfig/2019-10-09/APIReference/API_appconfigdata_StartConfigurationSession.html
const identifierRule = {
	type: "string",
	maxLength: 128,
	pattern: /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u,
};
// Flag keys match "^[a-z][a-zA-Z\\d_-]{0,63}$":
// https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-type-reference-feature-flags.html
const flagKeyRule = {
	type: "string",
	maxLength: 64,
	pattern: /^[a-z][a-zA-Z\d_-]{0,63}$/u,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:appconfig-extension:options",
	type: "object",
	properties: {
		fetchData: {
			type: "object",
			propertyNames: keyNameRule,
			maxProperties: 1024,
			required: [],
			additionalProperties: {
				type: "object",
				properties: {
					application: identifierRule,
					environment: identifierRule,
					configuration: identifierRule,
					flag: {
						oneOf: [
							flagKeyRule,
							{
								type: "array",
								items: flagKeyRule,
								maxItems: 1024,
								uniqueItems: true,
								unevaluatedItems: false,
							},
						],
					},
				},
				required: ["application", "environment", "configuration"],
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

export const appConfigExtensionValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// A fetch that hangs past the invocation would be cut off by Lambda; abort it
// 500 ms early instead so the failure surfaces and the cache entry is evicted.
// Outside an invocation (prefetch) allow 30 s.
const fetchTimeoutSignal = (request) =>
	AbortSignal.timeout(
		Math.max(
			1000,
			(request.context?.getRemainingTimeInMillis?.() ?? 30_000) - 500,
		),
	);

const appConfigExtensionMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const port = process.env.AWS_APPCONFIG_EXTENSION_HTTP_PORT ?? 2772;
	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);

	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			const { application, environment, configuration, flag } =
				options.fetchData[internalKey];
			let url = `http://localhost:${port}/applications/${encodeURIComponent(application)}/environments/${encodeURIComponent(environment)}/configurations/${encodeURIComponent(configuration)}`;
			if (flag) {
				const flags = Array.isArray(flag) ? flag : [flag];
				if (flags.length) {
					url += `?${flags
						.map((f) => `flag=${encodeURIComponent(f)}`)
						.join("&")}`;
				}
			}
			values[internalKey] = fetch(url, { signal: fetchTimeoutSignal(request) })
				.then((res) => {
					if (!res.ok) {
						throw new Error(`${pkg} ${res.status} ${res.statusText}`, {
							cause: { package: pkg },
						});
					}
					// `get` yields null for an absent header, which `test` reads as the
					// string "null": not a JSON media type, so the body is read as text.
					return jsonContentTypePattern.test(res.headers.get("Content-Type"))
						? res.json()
						: res.text();
				})
				.catch(evictCacheOnFailure(options.cacheKey, internalKey, values));
		}
		return values;
	};

	if (canPrefetch(options)) {
		processCache(options, fetchRequest);
	}

	const appConfigExtensionMiddlewareBefore = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	return { before: appConfigExtensionMiddlewareBefore };
};

export default appConfigExtensionMiddleware;

// used for TS type inference (see index.d.ts)
export function appConfigExtensionParam(config) {
	return config;
}
