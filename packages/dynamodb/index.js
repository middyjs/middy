// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
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

const keyNameRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};
const attributeNameRule = {
	type: "string",
	maxLength: 65535,
	pattern: /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u,
};

const functionRule = { $ref: "#/$defs/Function" };

// The DynamoDBClientConfigType keys beyond the ones every client shares:
// node_modules/@aws-sdk/client-dynamodb/dist-types/DynamoDBClient.d.ts
const awsClientOptionsRule = {
	...awsClientOptionsSchema,
	properties: {
		...awsClientOptionsSchema.properties,
		accountId: {
			oneOf: [
				{ type: "string", maxLength: 12, pattern: /^\d{12}$/u },
				functionRule,
			],
		},
		accountIdEndpointMode: {
			oneOf: [
				{ type: "string", enum: ["disabled", "preferred", "required"] },
				functionRule,
			],
		},
		endpointCacheSize: {
			type: "integer",
			minimum: 0,
			maximum: Number.MAX_SAFE_INTEGER,
		},
		endpointDiscoveryEnabled: { type: "boolean" },
		endpointDiscoveryEnabledProvider: functionRule,
	},
};

// GetItem request parameters:
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html
// Expression and key limits:
// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Constraints.html
const getItemInputSchema = {
	type: "object",
	properties: {
		TableName: { type: "string", maxLength: 1024, pattern: /^[\w.:/-]+$/u },
		// "For a composite primary key, you must provide values for both the
		// partition key and the sort key." Key attribute names are 1 to 255:
		// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_KeySchemaElement.html
		Key: {
			type: "object",
			propertyNames: {
				...attributeNameRule,
				maxLength: 255,
				not: { type: "string", enum: reservedPropertyNames },
			},
			maxProperties: 2,
			required: [],
			// A string key is at most "2048 bytes". marshall throws for a number
			// beyond Number.MAX_SAFE_INTEGER either way:
			// node_modules/@aws-sdk/util-dynamodb/dist-es/convertToAttr.js
			additionalProperties: {
				type: ["string", "number"],
				maxLength: 2048,
				pattern: /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u,
				minimum: -Number.MAX_SAFE_INTEGER,
				maximum: Number.MAX_SAFE_INTEGER,
			},
			unevaluatedProperties: false,
		},
		AttributesToGet: {
			type: "array",
			items: attributeNameRule,
			minItems: 1,
			maxItems: 1024,
			uniqueItems: true,
			unevaluatedItems: false,
		},
		ConsistentRead: { type: "boolean" },
		// "The maximum length of any single expression attribute name or
		// expression attribute value is 255 bytes."
		ExpressionAttributeNames: {
			type: "object",
			propertyNames: { type: "string", maxLength: 255, pattern: /^#\w+$/u },
			maxProperties: 1024,
			required: [],
			additionalProperties: attributeNameRule,
			unevaluatedProperties: false,
		},
		// "The maximum length of any expression string is 4 KB."
		ProjectionExpression: { ...attributeNameRule, maxLength: 4096 },
		ReturnConsumedCapacity: {
			type: "string",
			enum: ["INDEXES", "TOTAL", "NONE"],
		},
	},
	required: ["TableName", "Key"],
	additionalProperties: false,
	unevaluatedProperties: false,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:dynamodb:options",
	$defs: { Function: false, Object: false },
	type: "object",
	properties: {
		AwsClient: functionRule,
		awsClientOptions: awsClientOptionsRule,
		awsClientAssumeRole: keyNameRule,
		awsClientCapture: functionRule,
		fetchData: {
			type: "object",
			propertyNames: keyNameRule,
			maxProperties: 1024,
			required: [],
			additionalProperties: getItemInputSchema,
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
