// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	evictCacheOnFailure,
	jsonSafeParse,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "ssm-extension";
const pkg = `@middy/${name}`;

const defaults = {
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
		fetchData: { type: "object", additionalProperties: { type: "string" } },
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
		awsSessionToken: { instanceof: "Function" },
	},
	additionalProperties: false,
};

export const ssmExtensionValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// A fetch that hangs past the invocation would be cut off by Lambda; abort it
// 500 ms early instead so the failure surfaces and the cache entry is evicted.
// Outside an invocation (prefetch) allow 30 s.
const fetchTimeoutSignal = (request) =>
	AbortSignal.timeout(
		Math.max(
			1000,
			(request?.context?.getRemainingTimeInMillis?.() ?? 30_000) - 500,
		),
	);

// Matches @middy/ssm: a StringList is split into an array.
const parseValue = (param) => {
	if (param?.Type === "StringList") {
		return param.Value.split(",");
	}
	return jsonSafeParse(param?.Value);
};

const ssmExtensionMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const port = process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? 2773;
	const baseUrl = `http://localhost:${port}/systemsmanager/parameters/get/?withDecryption=true&name=`;

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);

	const fetchRequest = (request, cachedValues = {}) => {
		// Lambda does not set AWS_SESSION_TOKEN in every initialization mode
		// (e.g. SnapStart); AWS recommends reading the session token from an
		// AWS SDK credential provider chain, which `awsSessionToken` supplies.
		// The extension rejects a request without it.
		// https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html
		let token;
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			token ??= Promise.try(
				() => options.awsSessionToken?.() ?? process.env.AWS_SESSION_TOKEN,
			);
			values[internalKey] = token
				.then((token) => {
					if (typeof token === "undefined") {
						throw new Error(
							`${pkg} requires AWS_SESSION_TOKEN or the awsSessionToken option`,
							{ cause: { package: pkg } },
						);
					}
					return fetch(
						baseUrl +
							encodeURIComponent(options.fetchData[internalKey])
								.replaceAll("%2F", "/")
								.replaceAll("%3A", ":"),
						{
							headers: { "X-Aws-Parameters-Secrets-Token": token },
							signal: fetchTimeoutSignal(request),
						},
					);
				})
				.then((res) => {
					if (!res.ok) {
						throw new Error(`${pkg} ${res.status} ${res.statusText}`, {
							cause: { package: pkg },
						});
					}
					return res.json();
				})
				.then((res) => parseValue(res.Parameter))
				.catch(evictCacheOnFailure(options.cacheKey, internalKey, values));
		}
		return values;
	};

	if (canPrefetch(options)) {
		processCache(options, fetchRequest);
	}

	const ssmExtensionMiddlewareBefore = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	return {
		before: ssmExtensionMiddlewareBefore,
	};
};

export default ssmExtensionMiddleware;

// used for TS type inference (see index.d.ts)
export function ssmExtensionParam(path) {
	return path;
}
