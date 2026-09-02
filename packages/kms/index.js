// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	catchInvalidSignatureException,
	createClient,
	createPrefetchClient,
	getCache,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "kms";
const pkg = `@middy/${name}`;

const defaults = {
	AwsClient: KMSClient, // Allow for XRay
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {}, // { internalKey: 'alias/key-id' or full KeyId ARN }
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
			additionalProperties: { type: "string" },
		},
		disablePrefetch: { type: "boolean" },
		cacheKey: { type: "string" },
		cacheKeyExpiry: {
			type: "object",
			additionalProperties: { type: "number", minimum: -1 },
		},
		cacheExpiry: { type: "number", minimum: -1 },
		setToContext: { type: "boolean" },
		contextKey: { type: "string" },
	},
	additionalProperties: false,
};

export const kmsValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const kmsMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			const keyId = options.fetchData[internalKey];
			const command = new GetPublicKeyCommand({ KeyId: keyId });
			values[internalKey] = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then((resp) => ({ publicKey: resp.PublicKey, keySpec: resp.KeySpec }))
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

	const kmsMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const kmsMiddlewareBefore = (request) => {
		if (client) return kmsMiddlewareFetch(request);
		clientInit ??= createClient(options, request);
		return clientInit.then((resolvedClient) => {
			client = resolvedClient;
			return kmsMiddlewareFetch(request);
		});
	};

	return {
		before: kmsMiddlewareBefore,
	};
};

export default kmsMiddleware;
