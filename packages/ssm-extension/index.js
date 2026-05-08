// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	canPrefetch,
	getCache,
	getInternal,
	jsonSafeParse,
	modifyCache,
	processCache,
	validateOptions,
} from "../util/index.js";

const name = "ssm-extension";
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

export const ssmExtensionValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const ssmExtensionMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const port = process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? 2773;
	const baseUrl = `http://localhost:${port}/systemsmanager/parameters/get/?withDecryption=true&name=`;

	const fetchRequest = (request, cachedValues = {}) => {
		const headers = {
			"X-Aws-Parameters-Secrets-Token": process.env.AWS_SESSION_TOKEN,
		};
		const values = {};
		for (const internalKey of Object.keys(options.fetchData)) {
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
				.then((res) => jsonSafeParse(res.Parameter?.Value))
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

	const ssmExtensionMiddlewareBefore = async (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (options.setToContext) {
			const data = await getInternal(Object.keys(options.fetchData), request);
			Object.assign(request.context, data);
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
