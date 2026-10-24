// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
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

const name = "dynamodb";
const pkg = `@middy/${name}`;

const defaults = {
	AwsClient: DynamoDBClient,
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
				required: ["TableName", "Key"],
				properties: {
					TableName: { type: "string" },
					Key: { type: "object", additionalProperties: true },
					AttributesToGet: {
						type: "array",
						items: { type: "string" },
					},
					ConsistentRead: { type: "boolean" },
					ReturnConsumedCapacity: {
						type: "string",
						enum: ["INDEXES", "TOTAL", "NONE"],
					},
					ProjectionExpression: { type: "string" },
					ExpressionAttributeNames: {
						type: "object",
						additionalProperties: { type: "string" },
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

export const dynamodbValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);
const dynamodbMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		fetchData: structuredClone({ ...defaults.fetchData, ...opts.fetchData }),
	};

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
	// force marshall of Key during cold start
	for (const internalKey of fetchDataKeys) {
		options.fetchData[internalKey].Key = marshall(
			options.fetchData[internalKey].Key,
		);
	}

	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			const inputParameters = options.fetchData[internalKey];
			const command = new GetItemCommand(inputParameters);
			values[internalKey] = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then((resp) => (resp.Item ? unmarshall(resp.Item) : undefined))
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
	const dynamodbMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const dynamodbMiddlewareBefore = (request) => {
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation.
		if (client && !options.awsClientAssumeRole) {
			return dynamodbMiddlewareFetch(request);
		}
		return clientInit(request).then((resolvedClient) => {
			client = resolvedClient;
			return dynamodbMiddlewareFetch(request);
		});
	};
	return {
		before: dynamodbMiddlewareBefore,
	};
};

// used for TS type inference (see index.d.ts)
export function dynamoDbParam(req) {
	return req;
}

export default dynamodbMiddleware;
