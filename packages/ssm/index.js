// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	GetParametersByPathCommand,
	GetParametersCommand,
	SSMClient,
} from "@aws-sdk/client-ssm";
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	catchInvalidSignatureException,
	createClientInit,
	createPrefetchClient,
	evictCacheOnFailure,
	jsonSafeParse,
	processCache,
	sanitizeKey,
	validateOptions,
} from "@middy/util";

const name = "ssm";
const pkg = `@middy/${name}`;

const defaults = {
	AwsClient: SSMClient, // Allow for XRay
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {}, // { internalKey: fetchKey } | { internalKey: fetchPath/ }
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
	contextKey: name,
	awsRequestLimit: 10,
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
			additionalProperties: { type: "string" },
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
		awsRequestLimit: { type: "integer", minimum: 1, maximum: 10 },
	},
	additionalProperties: false,
};

export const ssmValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const ssmMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
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

		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			if (options.fetchData[internalKey].endsWith("/")) continue; // Skip path passed in
			namedKeys.push(internalKey);
		}

		for (const [idx, internalKey] of namedKeys.entries()) {
			const fetchKey = options.fetchData[internalKey];
			batchKeys.set(internalKey, fetchKey);
			// Flush once the batch holds awsRequestLimit names, or on the last name.
			if (
				(idx + 1) % options.awsRequestLimit !== 0 &&
				idx + 1 !== namedKeys.length
			) {
				continue;
			}

			const command = new GetParametersCommand({
				Names: Array.from(batchKeys.values()),
				WithDecryption: true,
			});
			batchReq = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then((resp) => {
					// Don't sanitize key, mapped to set value in options
					const result = {};
					// Every key naming an invalid parameter rejects, and so evicts
					// itself below.
					for (const fetchKey of resp.InvalidParameters ?? []) {
						result[fetchKey] = Promise.reject(
							new Error(`InvalidParameter ${fetchKey}`, {
								cause: { package: pkg },
							}),
						);
					}
					// `Parameters` is optional in the GetParameters response.
					// https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_GetParameters.html
					if (resp.Parameters !== undefined) {
						for (const param of resp.Parameters) {
							// A `name:version` / `name:label` request comes back as the bare
							// Name plus Selector (":version" / ":label").
							// https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-paramstore-labels.html
							const selector = param.Selector ?? "";
							const value = parseValue(param);
							result[param.Name + selector] = value;
							// Keyed by ARN too, for a request by ARN (required for a
							// parameter shared from another account): the Name alone is
							// the same for same-named parameters in different accounts.
							// https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_Parameter.html
							if (param.ARN !== undefined) result[param.ARN + selector] = value;
						}
					}
					return result;
				});

			// Each key evicts itself, so a batch that fails after a newer cycle
			// replaced its entry leaves the fresh values in place.
			for (const [internalKey, fetchKey] of batchKeys.entries()) {
				values[internalKey] = batchReq
					.then((params) => params[fetchKey])
					.catch(evictCacheOnFailure(options.cacheKey, internalKey, values));
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
			values[internalKey] = fetchPathRequest(fetchKey).catch(
				evictCacheOnFailure(options.cacheKey, internalKey, values),
			);
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
				for (const param of resp.Parameters ?? []) {
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
	const clientInit = createClientInit(options);
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}

	const ssmMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const ssmMiddlewareBefore = (request) => {
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation (util memoises on
		// the credential promise identity, so a hit costs one microtask).
		if (client && !options.awsClientAssumeRole) {
			return ssmMiddlewareFetch(request);
		}
		return clientInit(request).then((resolvedClient) => {
			client = resolvedClient;
			return ssmMiddlewareFetch(request);
		});
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
