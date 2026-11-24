// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	DiscoverInstancesCommand,
	ServiceDiscoveryClient,
} from "@aws-sdk/client-servicediscovery";
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
	validateOptions,
} from "@middy/util";

const name = "service-discovery";
const pkg = `@middy/${name}`;

const defaults = {
	AwsClient: ServiceDiscoveryClient,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {}, // { internalKey: {NamespaceName, ServiceName, HealthStatus} }
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

// https://docs.aws.amazon.com/cloud-map/latest/api/API_DiscoverInstances.html
const attributeFilterSchema = {
	type: "object",
	propertyNames: {
		type: "string",
		maxLength: 255,
		pattern: /^[\x21-\x7E]+$/u,
		not: { type: "string", enum: reservedPropertyNames },
	},
	maxProperties: 1024,
	required: [],
	additionalProperties: {
		type: "string",
		maxLength: 1024,
		pattern: /^(?:[\x21-\x7E][\t\x20-\x7E]*)?$/u,
	},
	unevaluatedProperties: false,
};

const discoverInstancesInputSchema = {
	type: "object",
	properties: {
		NamespaceName: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\x21-\x7E]+$/u,
		},
		ServiceName: { type: "string", maxLength: 127, pattern: /^[\w.-]+$/u },
		MaxResults: { type: "integer", minimum: 1, maximum: 1000 },
		QueryParameters: attributeFilterSchema,
		OptionalParameters: attributeFilterSchema,
		HealthStatus: {
			type: "string",
			enum: ["HEALTHY", "UNHEALTHY", "ALL", "HEALTHY_OR_ELSE_ALL"],
		},
		OwnerAccount: { type: "string", maxLength: 12, pattern: /^\d{12}$/u },
	},
	required: ["NamespaceName", "ServiceName"],
	additionalProperties: false,
	unevaluatedProperties: false,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:service-discovery:options",
	$defs: { Function: false, Object: false },
	type: "object",
	properties: {
		AwsClient: { $ref: "#/$defs/Function" },
		awsClientOptions: awsClientOptionsSchema,
		awsClientAssumeRole: internalKeySchema,
		awsClientCapture: { $ref: "#/$defs/Function" },
		fetchData: {
			type: "object",
			propertyNames: internalKeySchema,
			maxProperties: 1024,
			required: [],
			additionalProperties: discoverInstancesInputSchema,
			unevaluatedProperties: false,
		},
		...cacheOptionSchemaProperties,
		setToContext: { type: "boolean" },
		contextKey: internalKeySchema,
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const serviceDiscoveryValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const serviceDiscoveryMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};

		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;

			const command = new DiscoverInstancesCommand(
				options.fetchData[internalKey],
			);
			values[internalKey] = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then((resp) => resp.Instances)
				.catch(evictCacheOnFailure(options.cacheKey, internalKey, values));
		}

		return values;
	};

	let client;
	const clientInit = createClientInit(options);
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}

	const serviceDiscoveryMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const serviceDiscoveryMiddlewareBefore = (request) => {
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation (util memoises on
		// the credential promise identity, so a hit costs one microtask).
		if (client && !options.awsClientAssumeRole) {
			return serviceDiscoveryMiddlewareFetch(request);
		}
		return clientInit(request).then((resolvedClient) => {
			client = resolvedClient;
			return serviceDiscoveryMiddlewareFetch(request);
		});
	};

	return {
		before: serviceDiscoveryMiddlewareBefore,
	};
};
export default serviceDiscoveryMiddleware;

// used for TS type inference (see index.d.ts)
export function serviceDiscoveryParam(name) {
	return name;
}
