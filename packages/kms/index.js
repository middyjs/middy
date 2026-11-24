// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
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

const keyNameRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:kms:options",
	$defs: { Function: false, Object: false },
	type: "object",
	properties: {
		AwsClient: { $ref: "#/$defs/Function" },
		awsClientOptions: awsClientOptionsSchema,
		awsClientAssumeRole: keyNameRule,
		awsClientCapture: { $ref: "#/$defs/Function" },
		fetchData: {
			type: "object",
			propertyNames: keyNameRule,
			maxProperties: 1024,
			required: [],
			// GetPublicKey KeyId: a key ID, key ARN, alias name or alias ARN.
			// "Length Constraints: Minimum length of 1. Maximum length of 2048."
			// https://docs.aws.amazon.com/kms/latest/APIReference/API_GetPublicKey.html
			additionalProperties: {
				type: "string",
				maxLength: 2048,
				pattern: /^[\w.:/-]+$/u,
			},
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

	const kmsMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const kmsMiddlewareBefore = (request) => {
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation.
		if (client && !options.awsClientAssumeRole) {
			return kmsMiddlewareFetch(request);
		}
		return clientInit(request).then((resolvedClient) => {
			client = resolvedClient;
			return kmsMiddlewareFetch(request);
		});
	};

	return {
		before: kmsMiddlewareBefore,
	};
};

export default kmsMiddleware;
