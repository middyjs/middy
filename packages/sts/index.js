// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
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

const name = "sts";
const pkg = `@middy/${name}`;

const defaults = {
	AwsClient: STSClient,
	awsClientOptions: {},
	// awsClientAssumeRole: undefined, // Not Applicable, as this is the middleware that defines the roles
	awsClientCapture: undefined,
	fetchData: {}, // { contextKey: {RoleArn, RoleSessionName} }
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
		disablePrefetch: { type: "boolean" },
		cacheKey: { type: "string" },
		cacheKeyExpiry: {
			type: "object",
			additionalProperties: { type: "number", minimum: -1 },
		},
		cacheExpiry: { type: "number", minimum: -1 },
		setToContext: { type: "boolean" },
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

const stsMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		fetchData: structuredClone({ ...defaults.fetchData, ...opts.fetchData }),
	};

	const fetchDataKeys = Object.keys(options.fetchData);
	const fetch = (request, cachedValues = {}) => {
		const values = {};

		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			const assumeRoleOptions = options.fetchData[internalKey];
			// Date cannot be used here to assign default session name, possibility of collision when > 1 role defined
			assumeRoleOptions.RoleSessionName ??= `middy-sts-session-${Math.ceil(Math.random() * 99999)}`;
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
		processCache(options, fetch);
	}

	const stsMiddlewareBefore = async (request) => {
		if (!client) {
			clientInit ??= createClient(options, request);
			client = await clientInit;
		}

		const { value } = processCache(options, fetch, request);

		Object.assign(request.internal, value);

		if (options.setToContext) {
			const data = await getInternal(fetchDataKeys, request);
			Object.assign(request.context, data);
		}
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
