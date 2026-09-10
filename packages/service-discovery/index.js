// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	DiscoverInstancesCommand,
	ServiceDiscoveryClient,
} from "@aws-sdk/client-servicediscovery";
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	catchInvalidSignatureException,
	createClientInit,
	createPrefetchClient,
	evictCacheOnFailure,
	processCache,
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
				required: ["NamespaceName", "ServiceName"],
				properties: {
					NamespaceName: { type: "string" },
					ServiceName: { type: "string" },
					MaxResults: { type: "integer", minimum: 1 },
					QueryParameters: {
						type: "object",
						additionalProperties: { type: "string" },
					},
					OptionalParameters: {
						type: "object",
						additionalProperties: { type: "string" },
					},
					HealthStatus: {
						type: "string",
						enum: ["HEALTHY", "UNHEALTHY", "ALL", "HEALTHY_OR_ELSE_ALL"],
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
		setToContext: { type: "boolean" },
		contextKey: { type: "string" },
	},
	additionalProperties: false,
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
