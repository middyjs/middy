// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	GetParametersByPathCommand,
	GetParametersCommand,
	SSMClient,
} from "@aws-sdk/client-ssm";
import {
	canPrefetch,
	catchInvalidSignatureException,
	createClient,
	createPrefetchClient,
	getCache,
	getInternal,
	jsonSafeParse,
	modifyCache,
	processCache,
	sanitizeKey,
} from "@middy/util";

const awsRequestLimit = 10;
const defaults = {
	AwsClient: SSMClient, // Allow for XRay
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {}, // { contextKey: fetchKey, contextPrefix: fetchPath/ }
	disablePrefetch: false,
	cacheKey: "ssm",
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
};

const ssmMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const fetchDataKeys = Object.keys(options.fetchData);
	const fetchDataValues = Object.values(options.fetchData);
	const fetchRequest = (request, cachedValues) => {
		const single = fetchSingleRequest(request, cachedValues);
		const path = fetchByPathRequest(request, cachedValues);
		return Object.assign(single, path);
	};

	const fetchSingleRequest = (request, cachedValues = {}) => {
		const values = {};
		let batchReq = null;
		const batchKeys = new Map();
		const namedKeys = [];

		const internalKeys = fetchDataKeys;
		const fetchKeys = fetchDataValues;
		for (const internalKey of internalKeys) {
			if (cachedValues[internalKey]) continue;
			if (options.fetchData[internalKey].endsWith("/")) continue; // Skip path passed in
			namedKeys.push(internalKey);
		}

		for (const [idx, internalKey] of namedKeys.entries()) {
			const fetchKey = options.fetchData[internalKey];
			batchKeys.set(internalKey, fetchKey);
			// from the first to the batch size skip, unless it's the last entry
			if (
				(!idx || (idx + 1) % awsRequestLimit !== 0) &&
				!(idx + 1 === namedKeys.length)
			) {
				continue;
			}

			const command = new GetParametersCommand({
				Names: Array.from(batchKeys.values()),
				WithDecryption: true,
			});
			const currentBatchInternalKeys = Array.from(batchKeys.keys());
			batchReq = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then((resp) => {
					// Don't sanitize key, mapped to set value in options
					const result = {};
					for (const fetchKey of resp.InvalidParameters ?? []) {
						result[fetchKey] = new Promise(() => {
							const internalKey = internalKeys[fetchKeys.indexOf(fetchKey)];
							const value = getCache(options.cacheKey).value ?? {};
							value[internalKey] = undefined;
							modifyCache(options.cacheKey, value);
							throw new Error(`InvalidParameter ${fetchKey}`, {
								cause: { package: "@middy/ssm" },
							});
						});
					}
					for (const param of resp.Parameters ?? []) {
						result[param.Name] = parseValue(param);
					}
					return result;
				})
				.catch((e) => {
					const value = getCache(options.cacheKey).value ?? {};
					for (const key of currentBatchInternalKeys) {
						value[key] = undefined;
					}
					modifyCache(options.cacheKey, value);
					throw e;
				});

			for (const [internalKey, fetchKey] of batchKeys.entries()) {
				values[internalKey] = batchReq.then((params) => {
					if (fetchKey.startsWith("arn:aws:ssm:")) {
						const matchingParamName = Object.keys(params).find((key) =>
							fetchKey.endsWith(`:parameter${key}`),
						);
						return params[matchingParamName];
					}

					return params[options.fetchData[internalKey]];
				});
			}

			batchKeys.clear();
			batchReq = null;
		}
		return values;
	};

	const fetchByPathRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			const fetchKey = options.fetchData[internalKey];
			if (!fetchKey.endsWith("/")) continue; // Skip not path passed in
			values[internalKey] = fetchPathRequest(fetchKey).catch((e) => {
				const value = getCache(options.cacheKey).value ?? {};
				value[internalKey] = undefined;
				modifyCache(options.cacheKey, value);
				throw e;
			});
		}
		return values;
	};

	const fetchPathRequest = (path, nextToken, values = {}) => {
		const command = new GetParametersByPathCommand({
			Path: path,
			NextToken: nextToken,
			Recursive: true,
			WithDecryption: true,
		});
		return client
			.send(command)
			.catch((e) => catchInvalidSignatureException(e, client, command))
			.then((resp) => {
				for (const param of resp.Parameters) {
					values[sanitizeKey(param.Name.replace(path, ""))] = parseValue(param);
				}
				if (resp.NextToken) {
					return fetchPathRequest(path, resp.NextToken, values);
				}
				return values;
			});
	};

	const parseValue = (param) => {
		if (param.Type === "StringList") {
			return param.Value.split(",");
		}
		return jsonSafeParse(param.Value);
	};

	let client;
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}

	const ssmMiddlewareBefore = async (request) => {
		if (!client) {
			client = await createClient(options, request);
		}

		const { value } = processCache(options, fetchRequest, request);

		Object.assign(request.internal, value);

		if (options.setToContext) {
			const data = await getInternal(fetchDataKeys, request);
			Object.assign(request.context, data);
		}
	};

	return {
		before: ssmMiddlewareBefore,
	};
};

export default ssmMiddleware;

// used for TS type inference (see index.d.ts)
export function ssmParam(name) {
	return name;
}
