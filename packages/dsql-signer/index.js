// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	evictCacheOnFailure,
	processCache,
	setCacheKeyExpiry,
	validateOptions,
} from "@middy/util";

const name = "dsql-signer";
const pkg = `@middy/${name}`;

// A DSQL authentication token "automatically expires in 15 minutes by
// default" (the maximum is 604,800 seconds); the SDK signer implements that
// as `expiresIn: 900`, the number of seconds the token is valid, unless the
// signer options override it. The token is cached for its validity minus a
// one minute margin so a warm container never presents an expired token. With
// an `expiresIn` of 60 s or less the margin leaves no lifetime, so the token
// is not cached and every invocation signs a fresh one.
// https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_authentication-token.html
const defaultExpiresIn = 900;
const expiryMarginMs = 60 * 1000;
const tokenLifetimeMs = (expiresIn) => expiresIn * 1000 - expiryMarginMs;

const defaults = {
	AwsClient: DsqlSigner,
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
					hostname: {
						type: "string",
						pattern:
							"^[a-z0-9]+\\.dsql(-[a-z]+)?\\.[a-z]{2}(-[a-z]+){1,2}-\\d+\\.on\\.aws$",
					},
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
		contextKey: { type: "string" },
	},
	additionalProperties: false,
};

export const dsqlSignerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const dsqlSignerMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		cacheKeyExpiry: { ...defaults.cacheKeyExpiry, ...opts.cacheKeyExpiry },
	};

	const defaultFetchData = {
		hostname: process.env.PGHOST ?? process.env.DBHOST,
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

			const { username, ...signerConfig } = options.fetchData[internalKey];
			const signerOptions = { ...options.awsClientOptions, ...signerConfig };
			clients[internalKey] ??= new options.AwsClient(signerOptions);
			const lifetimeMs = tokenLifetimeMs(
				signerOptions.expiresIn ?? defaultExpiresIn,
			);
			const method =
				username === "admin"
					? "getDbConnectAdminAuthToken"
					: "getDbConnectAuthToken";
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
					// A lifetime of zero or less records an expiry that has already
					// passed, which processCache treats as expired on the next read.
					setCacheKeyExpiry(options, Date.now() + lifetimeMs);
					return token;
				})
				.catch(evictCacheOnFailure(options.cacheKey, internalKey));
		}

		return values;
	};

	if (canPrefetch(options)) {
		processCache(options, fetchRequest);
	}

	const dsqlSignerMiddlewareBefore = (request) => {
		const { value } = processCache(options, fetchRequest, request);

		Object.assign(request.internal, value);

		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
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
