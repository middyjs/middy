// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { randomUUID } from "node:crypto";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
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

const name = "sts";
const pkg = `@middy/${name}`;

const defaults = {
	AwsClient: STSClient,
	awsClientOptions: {},
	// awsClientAssumeRole: undefined, // Not Applicable, as this is the middleware that defines the roles
	awsClientCapture: undefined,
	fetchData: {}, // { internalKey: {RoleArn, RoleSessionName} }
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
		disablePrefetch: { type: "boolean" },
		cacheKey: { type: "string" },
		cacheKeyExpiry: {
			type: "object",
			additionalProperties: { type: "number", minimum: -1 },
		},
		cacheExpiry: { type: "number", minimum: -1 },
		setToContext: { type: "boolean" },
		contextKey: { type: "string" },
		fetchData: {
			type: "object",
			additionalProperties: {
				type: "object",
				required: ["RoleArn"],
				properties: {
					RoleArn: { type: "string" },
					RoleSessionName: { type: "string" },
					DurationSeconds: { type: "integer", minimum: 900, maximum: 43200 },
					ExternalId: { type: "string" },
					Policy: { type: "string" },
					SerialNumber: { type: "string" },
					TokenCode: { type: "string" },
					TransitiveTagKeys: {
						type: "array",
						items: { type: "string" },
					},
				},
				additionalProperties: true,
			},
		},
	},
	additionalProperties: false,
};

export const stsValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const cloneFetchData = (fetchData) => {
	try {
		return structuredClone(fetchData);
	} catch (e) {
		throw new Error(
			`Invalid \`fetchData\` option: value is not cloneable (${e.message})`,
			{ cause: { package: pkg } },
		);
	}
};

const stsMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		fetchData: cloneFetchData({ ...defaults.fetchData, ...opts.fetchData }),
	};

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};

		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			const assumeRoleOptions = options.fetchData[internalKey];
			// Date cannot be used here to assign default session name, possibility of collision when > 1 role defined
			assumeRoleOptions.RoleSessionName ??= `@middy-sts-${randomUUID()}`;
			const command = new AssumeRoleCommand(assumeRoleOptions);
			values[internalKey] = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then((resp) => ({
					accessKeyId: resp.Credentials.AccessKeyId,
					secretAccessKey: resp.Credentials.SecretAccessKey,
					sessionToken: resp.Credentials.SessionToken,
				}))
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

	const stsMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const stsMiddlewareBefore = (request) => {
		if (client) return stsMiddlewareFetch(request);
		clientInit ??= createClient(options, request);
		return clientInit.then((resolvedClient) => {
			client = resolvedClient;
			return stsMiddlewareFetch(request);
		});
	};

	return {
		before: stsMiddlewareBefore,
	};
};
export default stsMiddleware;

// used for TS type inference (see index.d.ts)
export function stsParam(name) {
	return name;
}
