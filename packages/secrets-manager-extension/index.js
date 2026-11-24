// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	assignSetToContext,
	buildSetToContextSpec,
	cacheOptionSchemaProperties,
	canPrefetch,
	evictCacheOnFailure,
	jsonSafeParse,
	processCache,
	reservedPropertyNames,
	validateOptions,
} from "@middy/util";

const name = "secrets-manager-extension";
const pkg = `@middy/${name}`;

const defaults = {
	fetchData: {},
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	// The extension is the cache: it keeps a secret for SECRETS_MANAGER_TTL
	// ("Maximum valid lifetime, in seconds, of a secret in the cache before it
	// is invalidated", 300 s by default). It is asked on every invocation so
	// the function sees a rotated secret, instead of keeping the first one
	// for good.
	// https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html
	cacheExpiry: 0,
	setToContext: false,
	contextKey: name,
};

const internalKeySchema = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:secrets-manager-extension:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		fetchData: {
			type: "object",
			propertyNames: internalKeySchema,
			maxProperties: 1024,
			required: [],
			// https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
			additionalProperties: {
				type: "string",
				maxLength: 2048,
				pattern: /^[\x21-\x7E]+$/u,
			},
			unevaluatedProperties: false,
		},
		...cacheOptionSchemaProperties,
		setToContext: { type: "boolean" },
		contextKey: internalKeySchema,
		awsSessionToken: { $ref: "#/$defs/Function" },
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const secretsManagerExtensionValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// The extension returns the GetSecretValue JSON, which carries the secret in
// exactly one of two fields: SecretBinary "if the secret value was originally
// provided as binary data" (Base64-encoded over the HTTP API), otherwise
// "this field is omitted. The secret value appears in SecretString instead."
// Binary secrets are handed back as a Buffer.
// https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
// https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html
const parseSecretValue = (res) => {
	if (typeof res.SecretBinary !== "undefined") {
		return Buffer.from(res.SecretBinary, "base64");
	}
	return jsonSafeParse(res.SecretString);
};

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

const secretsManagerExtensionMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const port = process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? 2773;
	const baseUrl = `http://localhost:${port}/secretsmanager/get?secretId=`;

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);

	const fetchRequest = (request, cachedValues = {}) => {
		// Lambda does not set AWS_SESSION_TOKEN in every initialization mode
		// (e.g. SnapStart); AWS recommends reading the session token from an
		// AWS SDK credential provider chain, which `awsSessionToken` supplies.
		// The extension rejects a request without it.
		// https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html
		let token;
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			token ??= Promise.try(
				() => options.awsSessionToken?.() ?? process.env.AWS_SESSION_TOKEN,
			);
			values[internalKey] = token
				.then((token) => {
					if (typeof token === "undefined") {
						throw new Error(
							`${pkg} requires AWS_SESSION_TOKEN or the awsSessionToken option`,
							{ cause: { package: pkg } },
						);
					}
					return fetch(
						baseUrl +
							encodeURIComponent(options.fetchData[internalKey])
								.replaceAll("%2F", "/")
								.replaceAll("%3A", ":"),
						{
							headers: { "X-Aws-Parameters-Secrets-Token": token },
							signal: fetchTimeoutSignal(request),
						},
					);
				})
				.then((res) => {
					if (!res.ok) {
						throw new Error(`${pkg} ${res.status} ${res.statusText}`, {
							cause: { package: pkg },
						});
					}
					return res.json();
				})
				.then(parseSecretValue)
				.catch(evictCacheOnFailure(options.cacheKey, internalKey, values));
		}
		return values;
	};

	if (canPrefetch(options)) {
		processCache(options, fetchRequest);
	}

	const secretsManagerExtensionMiddlewareBefore = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	return {
		before: secretsManagerExtensionMiddlewareBefore,
	};
};

export default secretsManagerExtensionMiddleware;

// used for TS type inference (see index.d.ts)
export function secretsManagerExtensionParam(secretId) {
	return secretId;
}
