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
} from "@middy/util";

const defaults = {
	AwsClient: DynamoDBClient,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {},
	disablePrefetch: false,
	cacheKey: "dynamodb",
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
};
const dynamodbMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		fetchData: structuredClone({ ...defaults.fetchData, ...opts.fetchData }),
	};

	// force marshall of Key during cold start
	for (const internalKey in options.fetchData) {
		options.fetchData[internalKey].Key = marshall(
			options.fetchData[internalKey].Key,
		);
	}

	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey in options.fetchData) {
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
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}
	const dynamodbMiddlewareBefore = async (request) => {
		if (!client) {
			client = await createClient(options, request);
		}
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (options.setToContext) {
			const data = await getInternal(Object.keys(options.fetchData), request);
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
