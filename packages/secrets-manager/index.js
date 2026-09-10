// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	DescribeSecretCommand,
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
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
	setCacheKeyExpiry,
	validateOptions,
} from "@middy/util";

const name = "secrets-manager";
const pkg = `@middy/${name}`;

// How long an overdue rotation (NextRotationDate already passed) keeps the
// cache before the secret is described again.
const rotationRetryMs = 60 * 1000;

const defaults = {
	AwsClient: SecretsManagerClient,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {},
	fetchRotationDate: false, // true: apply to all or {key: true} for individual
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	cacheExpiry: -1, // with fetchRotationDate: expires at NextRotationDate or after cacheExpiry, whichever is sooner
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
		fetchRotationDate: {
			oneOf: [
				{ type: "boolean" },
				{ type: "object", additionalProperties: { type: "boolean" } },
			],
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

export const secretsManagerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// GetSecretValue carries the secret in exactly one of two fields: SecretBinary
// "if the secret value was originally provided as binary data" (a Uint8Array
// once the SDK has decoded it), otherwise "this field is omitted. The secret
// value appears in SecretString instead." Binary secrets are handed back as a
// Buffer.
// https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
const parseSecretValue = (resp) => {
	if (typeof resp.SecretBinary !== "undefined") {
		return Buffer.from(resp.SecretBinary);
	}
	return jsonSafeParse(resp.SecretString);
};

const secretsManagerMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		cacheKeyExpiry: { ...defaults.cacheKeyExpiry, ...opts.cacheKeyExpiry },
	};

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);

	let client;
	const send = (command) =>
		client
			.send(command)
			.catch((e) => catchInvalidSignatureException(e, client, command));

	// Learn the secret's NextRotationDate so the cache entry expires at the
	// soonest rotation across the rotation-enabled keys, or after `cacheExpiry`
	// when that is shorter. A rotation date that has already passed means the
	// rotation has not run yet: keep the cache for a minute before describing
	// the secret again rather than on every invocation. One still ahead,
	// however close, expires the entry on time.
	const learnRotationDate = (resp) => {
		if (resp.NextRotationDate) {
			// The SDK unmarshals NextRotationDate to a Date, but a custom client
			// may hand back the ISO string; `new Date()` yields epoch ms for both.
			const nextRotation = Number(new Date(resp.NextRotationDate));
			const now = Date.now();
			setCacheKeyExpiry(
				options,
				nextRotation > now ? nextRotation : now + rotationRetryMs,
			);
		}
	};

	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};

		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;

			const SecretId = options.fetchData[internalKey];
			const fetchSecret = () =>
				send(new GetSecretValueCommand({ SecretId })).then(parseSecretValue);
			const fetchRotation =
				options.fetchRotationDate === true ||
				options.fetchRotationDate?.[internalKey];
			const fetched = fetchRotation
				? send(new DescribeSecretCommand({ SecretId }))
						.then(learnRotationDate)
						.then(fetchSecret)
				: fetchSecret();
			values[internalKey] = fetched.catch(
				evictCacheOnFailure(options.cacheKey, internalKey, values),
			);
		}
		return values;
	};

	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}

	const secretsManagerMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const clientInit = createClientInit(options);
	const secretsManagerMiddlewareBefore = (request) => {
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation (util memoises on
		// the credential promise identity, so a hit costs one microtask).
		if (client && !options.awsClientAssumeRole) {
			return secretsManagerMiddlewareFetch(request);
		}
		return clientInit(request).then((resolvedClient) => {
			client = resolvedClient;
			return secretsManagerMiddlewareFetch(request);
		});
	};

	return {
		before: secretsManagerMiddlewareBefore,
	};
};
export default secretsManagerMiddleware;

// used for TS type inference (see index.d.ts)
export function secretsManagerParam(name) {
	return name;
}
