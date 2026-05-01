// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
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
			additionalProperties: { type: "number", minimum: -1 },
		},
		cacheExpiry: { type: "number", minimum: -1 },
		setToContext: { type: "boolean" },
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
				.then((resp) => unmarshall(resp.Item))
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
	const dynamodbMiddlewareBefore = async (request) => {
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
		before: dynamodbMiddlewareBefore,
	};
};

// used for TS type inference (see index.d.ts)
export function dynamoDbParam(req) {
	return req;
}

export default dynamodbMiddleware;
