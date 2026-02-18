// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { Signer } from "@aws-sdk/rds-signer";
import {
	canPrefetch,
	getCache,
	getInternal,
	modifyCache,
	processCache,
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

const rdsSignerMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of Object.keys(options.fetchData)) {
			if (cachedValues[internalKey]) continue;

			const client = new options.AwsClient({
				...options.awsClientOptions,
				...options.fetchData[internalKey],
			});
			values[internalKey] = client
				.getAuthToken()
				.then((token) => {
					// Catch Missing token, this usually means their is something wrong with the credentials
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
			const data = await getInternal(Object.keys(options.fetchData), request);
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
