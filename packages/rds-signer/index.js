// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { Signer } from "@aws-sdk/rds-signer";
import {
	canPrefetch,
	getCache,
	getInternal,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "rds-signer";
const pkg = `@middy/${name}`;

const defaults = {
	AwsClient: Signer,
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
					hostname: { type: "string" },
					port: { type: "integer", minimum: 1, maximum: 65535 },
					username: { type: "string" },
				},
				required: [],
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

export const rdsSignerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const rdsSignerMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const defaultFetchData = {
		hostname: process.env.PGHOST ?? process.env.DBHOST,
		port: Number.parseInt(
			process.env.PGPORT ?? process.env.DBPORT ?? "5432",
			10,
		),
		username: process.env.PGUSER ?? process.env.DBUSER,
	};
	for (const key of Object.keys(options.fetchData)) {
		options.fetchData[key] = { ...defaultFetchData, ...options.fetchData[key] };
	}

	const fetchDataKeys = Object.keys(options.fetchData);
	const clients = {};
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;

			const signerConfig = options.fetchData[internalKey];
			clients[internalKey] ??= new options.AwsClient({
				...options.awsClientOptions,
				...signerConfig,
			});
			const method = "getAuthToken";
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

	const rdsSignerMiddlewareBefore = async (request) => {
		const { value } = processCache(options, fetchRequest, request);

		Object.assign(request.internal, value);

		if (options.setToContext) {
			const data = await getInternal(fetchDataKeys, request);
			Object.assign(request.context, data);
		}
	};

	return {
		before: rdsSignerMiddlewareBefore,
	};
};
export default rdsSignerMiddleware;

// used for TS type inference (see index.d.ts)
export function rdsSignerParam(name) {
	return name;
}
