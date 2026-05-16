// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	getCache,
	jsonSafeParse,
	modifyCache,
	processCache,
	validateOptions,
} from "../util/index.js";

const name = "secrets-manager-extension";
const pkg = `@middy/${name}`;

const defaults = {
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
		fetchData: { type: "object", additionalProperties: { type: "string" } },
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

export const secretsManagerExtensionValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const secretsManagerExtensionMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const port = process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? 2773;
	const baseUrl = `http://localhost:${port}/secretsmanager/get?secretId=`;

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);

	const fetchRequest = (request, cachedValues = {}) => {
		const headers = {
			"X-Aws-Parameters-Secrets-Token": process.env.AWS_SESSION_TOKEN,
		};
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			values[internalKey] = fetch(
				baseUrl +
					encodeURIComponent(options.fetchData[internalKey])
						.replaceAll("%2F", "/")
						.replaceAll("%3A", ":"),
				{ headers },
			)
				.then((res) => {
					if (!res.ok) {
						throw new Error(`${pkg} ${res.status} ${res.statusText}`, {
							cause: { package: pkg },
						});
					}
					return res.json();
				})
				.then((res) => jsonSafeParse(res.SecretString))
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

	const secretsManagerExtensionMiddlewareBefore = async (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			const pending = assignSetToContext(contextSpec, value, request);
			if (pending) await pending;
		}
	};

	return {
		before: secretsManagerExtensionMiddlewareBefore,
	};
};

export default secretsManagerExtensionMiddleware;

// used for TS type inference (see index.d.ts)
export function secretsManagerExtensionParam(secretId) {
	return secretId;
}
