// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { Signer } from "@aws-sdk/rds-signer";
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	evictCacheOnFailure,
	processCache,
	setCacheKeyExpiry,
	validateOptions,
} from "@middy/util";

const name = "rds-signer";
const pkg = `@middy/${name}`;

// The SDK signer issues tokens with `expiresIn: 900` (15 min). Refresh one
// minute early so a warm container never presents an expired token.
const tokenLifetimeMs = 14 * 60 * 1000;

const defaults = {
	AwsClient: Signer,
	awsClientOptions: {},
	fetchData: {},
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
		setToContext: { type: "boolean" },
		contextKey: { type: "string" },
	},
	additionalProperties: false,
};

export const rdsSignerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const rdsSignerMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		cacheKeyExpiry: { ...defaults.cacheKeyExpiry, ...opts.cacheKeyExpiry },
	};

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
		if (!options.fetchData[key].hostname) {
			throw new Error(
				`fetchData.${key}.hostname is required; set PGHOST, DBHOST, or pass hostname explicitly`,
				{ cause: { package: pkg } },
			);
		}
	}

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
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
					// Pre-signed token URLs always include X-Amz-Security-Token when temporary
					// credentials (IAM role) are used, which is always the case in Lambda.
					// A missing token usually indicates a credential or signing problem.
					if (!token.includes("X-Amz-Security-Token=")) {
						throw new Error("X-Amz-Security-Token Missing", {
							cause: { package: pkg, data: { method } },
						});
					}
					setCacheKeyExpiry(options, Date.now() + tokenLifetimeMs);
					return token;
				})
				.catch(evictCacheOnFailure(options.cacheKey, internalKey, values));
		}

		return values;
	};

	if (canPrefetch(options)) {
		processCache(options, fetchRequest);
	}

	const rdsSignerMiddlewareBefore = (request) => {
		const { value } = processCache(options, fetchRequest, request);

		Object.assign(request.internal, value);

		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
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
