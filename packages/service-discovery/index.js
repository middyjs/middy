// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	DiscoverInstancesCommand,
	ServiceDiscoveryClient,
} from "@aws-sdk/client-servicediscovery";
import {
	canPrefetch,
	catchInvalidSignatureException,
	createClient,
	createPrefetchClient,
	getCache,
	getInternal,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const defaults = {
	AwsClient: ServiceDiscoveryClient,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {}, // { contextKey: {NamespaceName, ServiceName, HealthStatus} }
	disablePrefetch: false,
	cacheKey: "service-discovery",
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
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
			additionalProperties: { type: "number", minimum: -1 },
		},
		cacheExpiry: { type: "number", minimum: -1 },
		setToContext: { type: "boolean" },
	},
	additionalProperties: false,
};

export const serviceDiscoveryValidateOptions = (options) =>
	validateOptions("@middy/service-discovery", optionSchema, options);

const serviceDiscoveryMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const fetchDataKeys = Object.keys(options.fetchData);
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
				.catch((e) => {
					const value = getCache(options.cacheKey).value ?? {};
					value[internalKey] = undefined;
					modifyCache(options.cacheKey, value);
					throw e;
				});
		}

		return values;
	};

	let client;
	let clientInit;
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}

	const serviceDiscoveryMiddlewareBefore = async (request) => {
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
		before: serviceDiscoveryMiddlewareBefore,
	};
};
export default serviceDiscoveryMiddleware;

// used for TS type inference (see index.d.ts)
export function serviceDiscoveryParam(name) {
	return name;
}
