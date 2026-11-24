// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { randomUUID } from "node:crypto";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
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
	processCache,
	reservedPropertyNames,
	setCacheKeyExpiry,
	validateOptions,
} from "@middy/util";

const name = "sts";
const pkg = `@middy/${name}`;

// Refresh credentials this long before STS says they expire.
const expirationMarginMs = 60 * 1000;

const defaults = {
	AwsClient: STSClient,
	awsClientOptions: {},
	// awsClientAssumeRole: undefined, // internalKey of credentials from an earlier sts instance, for role chaining
	awsClientCapture: undefined,
	fetchData: {}, // { internalKey: {RoleArn, RoleSessionName} }
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
	contextKey: name,
};

const internalKeySchema = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};

// https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
const arnPattern = /^arn:aws[\w-]*:[\w-]+:[\w-]*:[\w-]*:[\x21-\x7E]+$/u;
// https://docs.aws.amazon.com/STS/latest/APIReference/API_Tag.html
const tagKeySchema = {
	type: "string",
	minLength: 1,
	maxLength: 128,
	pattern: /^[\p{L}\p{Z}\p{N}_.:/=+@-]+$/u,
};

const assumeRoleInputSchema = {
	type: "object",
	properties: {
		RoleArn: {
			type: "string",
			minLength: 20,
			maxLength: 2048,
			pattern: arnPattern,
		},
		RoleSessionName: {
			type: "string",
			minLength: 2,
			maxLength: 64,
			pattern: /^[\w+=,.@-]+$/u,
		},
		PolicyArns: {
			type: "array",
			maxItems: 10,
			uniqueItems: true,
			// https://docs.aws.amazon.com/STS/latest/APIReference/API_PolicyDescriptorType.html
			items: {
				type: "object",
				properties: {
					arn: {
						type: "string",
						minLength: 20,
						maxLength: 2048,
						pattern: arnPattern,
					},
				},
				required: [],
				additionalProperties: false,
				unevaluatedProperties: false,
			},
			unevaluatedItems: false,
		},
		// "The plaintext that you use for both inline and managed session policies can't exceed 2,048 characters."
		Policy: {
			type: "string",
			minLength: 1,
			maxLength: 2048,
			pattern: /^[\t\n\r\x20-\x7E\xA0-\xFF]+$/u,
		},
		DurationSeconds: { type: "integer", minimum: 900, maximum: 43200 },
		Tags: {
			type: "array",
			maxItems: 50,
			uniqueItems: true,
			items: {
				type: "object",
				properties: {
					Key: tagKeySchema,
					Value: {
						type: "string",
						maxLength: 256,
						pattern: /^[\p{L}\p{Z}\p{N}_.:/=+@-]*$/u,
					},
				},
				required: ["Key", "Value"],
				additionalProperties: false,
				unevaluatedProperties: false,
			},
			unevaluatedItems: false,
		},
		TransitiveTagKeys: {
			type: "array",
			maxItems: 50,
			uniqueItems: true,
			items: tagKeySchema,
			unevaluatedItems: false,
		},
		ExternalId: {
			type: "string",
			minLength: 2,
			maxLength: 1224,
			pattern: /^[\w+=,.@:/-]+$/u,
		},
		SerialNumber: {
			type: "string",
			minLength: 9,
			maxLength: 256,
			pattern: /^[\w+=/:,.@-]+$/u,
		},
		TokenCode: { type: "string", maxLength: 6, pattern: /^\d{6}$/u },
		SourceIdentity: {
			type: "string",
			minLength: 2,
			maxLength: 64,
			pattern: /^[\w+=,.@-]+$/u,
		},
		ProvidedContexts: {
			type: "array",
			minItems: 1,
			maxItems: 5,
			uniqueItems: true,
			// https://docs.aws.amazon.com/STS/latest/APIReference/API_ProvidedContext.html
			items: {
				type: "object",
				properties: {
					ProviderArn: {
						type: "string",
						minLength: 20,
						maxLength: 2048,
						pattern: arnPattern,
					},
					ContextAssertion: {
						type: "string",
						minLength: 4,
						maxLength: 2048,
						pattern: /^[\x21-\x7E]+$/u,
					},
				},
				required: [],
				additionalProperties: false,
				unevaluatedProperties: false,
			},
			unevaluatedItems: false,
		},
		MinimumSessionTokenSize: { type: "integer", minimum: 0, maximum: 4096 },
	},
	required: ["RoleArn"],
	additionalProperties: false,
	unevaluatedProperties: false,
};

// node_modules/@aws-sdk/client-sts/dist-types/endpoint/EndpointParameters.d.ts (ClientInputEndpointParameters)
const stsClientOptionsSchema = {
	...awsClientOptionsSchema,
	properties: {
		...awsClientOptionsSchema.properties,
		useGlobalEndpoint: {
			oneOf: [{ type: "boolean" }, { $ref: "#/$defs/Function" }],
		},
	},
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:sts:options",
	$defs: { Function: false, Object: false },
	type: "object",
	properties: {
		AwsClient: { $ref: "#/$defs/Function" },
		awsClientOptions: stsClientOptionsSchema,
		awsClientAssumeRole: internalKeySchema,
		awsClientCapture: { $ref: "#/$defs/Function" },
		...cacheOptionSchemaProperties,
		setToContext: { type: "boolean" },
		contextKey: internalKeySchema,
		fetchData: {
			type: "object",
			propertyNames: internalKeySchema,
			maxProperties: 1024,
			required: [],
			additionalProperties: assumeRoleInputSchema,
			unevaluatedProperties: false,
		},
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const stsValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const cloneFetchData = (fetchData) => {
	try {
		return structuredClone(fetchData);
	} catch (e) {
		throw new Error(
			`Invalid \`fetchData\` option: value is not cloneable (${e.message})`,
			{ cause: { package: pkg } },
		);
	}
};

const stsMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		fetchData: cloneFetchData({ ...defaults.fetchData, ...opts.fetchData }),
		cacheKeyExpiry: { ...defaults.cacheKeyExpiry, ...opts.cacheKeyExpiry },
	};

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};

		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			const assumeRoleOptions = options.fetchData[internalKey];
			// Date cannot be used here to assign default session name, possibility of collision when > 1 role defined.
			// The default goes on a copy: written into fetchData it would change
			// the cache ownership fingerprint, so an identical instance could no
			// longer share the cacheKey.
			const command = new AssumeRoleCommand({
				...assumeRoleOptions,
				RoleSessionName:
					assumeRoleOptions.RoleSessionName ?? `@middy-sts-${randomUUID()}`,
			});
			values[internalKey] = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then((resp) => {
					// The SDK unmarshals `Expiration` to a Date, but a custom client may
					// hand back the ISO string; `new Date()` yields epoch ms for both.
					// Clamp the cache entry to the earliest credential expiry of this
					// cycle, less a safety margin, so a `-1` cacheExpiry never serves
					// expired credentials.
					const { Expiration } = resp.Credentials;
					setCacheKeyExpiry(
						options,
						Expiration
							? Number(new Date(Expiration)) - expirationMarginMs
							: Number.POSITIVE_INFINITY,
					);
					return {
						accessKeyId: resp.Credentials.AccessKeyId,
						secretAccessKey: resp.Credentials.SecretAccessKey,
						sessionToken: resp.Credentials.SessionToken,
					};
				})
				.catch(evictCacheOnFailure(options.cacheKey, internalKey, values));
		}

		return values;
	};

	let client;
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}

	const stsMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const clientInit = createClientInit(options);
	const stsMiddlewareBefore = (request) => {
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation (util memoises on
		// the credential promise identity, so a hit costs one microtask).
		if (client && !options.awsClientAssumeRole) {
			return stsMiddlewareFetch(request);
		}
		return clientInit(request).then((resolvedClient) => {
			client = resolvedClient;
			return stsMiddlewareFetch(request);
		});
	};

	return {
		before: stsMiddlewareBefore,
	};
};
export default stsMiddleware;

// used for TS type inference (see index.d.ts)
export function stsParam(name) {
	return name;
}
