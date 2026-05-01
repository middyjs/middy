// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import {
	canPrefetch,
	getCache,
	getInternal,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "dsql-signer";
const pkg = `@middy/${name}`;

const defaults = {
	AwsClient: DsqlSigner,
	awsClientOptions: {},
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
		fetchData: {
			type: "object",
			additionalProperties: {
				type: "object",
				properties: {
					hostname: {
						type: "string",
						pattern:
							"^[a-z0-9]+\\.dsql(-[a-z]+)?\\.[a-z]{2}(-[a-z]+){1,2}-\\d+\\.on\\.aws$",
					},
					username: { type: "string" },
				},
				required: ["hostname"],
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

export const dsqlSignerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const dsqlSignerMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const fetchDataKeys = Object.keys(options.fetchData);
	const clients = {};
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;

			const { username, ...signerConfig } = options.fetchData[internalKey];
			clients[internalKey] ??= new options.AwsClient({
				...options.awsClientOptions,
				...signerConfig,
			});
			const method =
				username === "admin"
					? "getDbConnectAdminAuthToken"
					: "getDbConnectAuthToken";
			values[internalKey] = clients[internalKey]
				[method]()
				.then((token) => {
					// Catch Missing token, this usually means there is something wrong with the credentials
					if (!token.includes("X-Amz-Security-Token=")) {
						throw new Error("X-Amz-Security-Token Missing", {
							cause: { package: pkg, method },
						});
					}
					return token;
				})
				.catch((e) => {
					const value = getCache(options.cacheKey).value ?? {};
					value[internalKey] = undefined;
					modifyCache(options.cacheKey, value);
					throw e;
				});
		}

		return values;
	};

	if (canPrefetch(options)) {
		processCache(options, fetchRequest);
	}

	const dsqlSignerMiddlewareBefore = async (request) => {
		const { value } = processCache(options, fetchRequest, request);

		Object.assign(request.internal, value);

		if (options.setToContext) {
			const data = await getInternal(fetchDataKeys, request);
			Object.assign(request.context, data);
		}
	};

	return {
		before: dsqlSignerMiddlewareBefore,
	};
};
export default dsqlSignerMiddleware;

// used for TS type inference (see index.d.ts)
export function dsqlSignerParam(name) {
	return name;
}
