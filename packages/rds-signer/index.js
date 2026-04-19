// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { Signer } from "@aws-sdk/rds-signer";
import {
	awsClientOptionSchema,
	canPrefetch,
	getCache,
	getInternal,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const defaults = {
	AwsClient: Signer,
	awsClientOptions: {},
	fetchData: {},
	disablePrefetch: false,
	cacheKey: "rds-signer",
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
};

const optionSchema = { ...awsClientOptionSchema };

export const rdsSignerValidateOptions = (options) =>
	validateOptions("@middy/rds-signer", optionSchema, options);

const rdsSignerMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const fetchDataKeys = Object.keys(options.fetchData);
	const clients = {};
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;

			clients[internalKey] ??= new options.AwsClient({
				...options.awsClientOptions,
				...options.fetchData[internalKey],
			});
			values[internalKey] = clients[internalKey]
				.getAuthToken()
				.then((token) => {
					// Catch Missing token, this usually means there is something wrong with the credentials
					if (!token.includes("X-Amz-Security-Token=")) {
						throw new Error("X-Amz-Security-Token Missing", {
							cause: { package: "@middy/rds-signer" },
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
