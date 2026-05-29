// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	getCache,
	jsonContentTypePattern,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "appconfig-extension";
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
		fetchData: {
			type: "object",
			additionalProperties: {
				type: "object",
				properties: {
					application: { type: "string" },
					environment: { type: "string" },
					configuration: { type: "string" },
					flag: {
						oneOf: [
							{ type: "string" },
							{ type: "array", items: { type: "string" } },
						],
					},
				},
				required: ["application", "environment", "configuration"],
				additionalProperties: false,
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

export const appConfigExtensionValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const appConfigExtensionMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const port = process.env.AWS_APPCONFIG_EXTENSION_HTTP_PORT ?? 2772;
	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);

	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			const { application, environment, configuration, flag } =
				options.fetchData[internalKey];
			let url = `http://localhost:${port}/applications/${encodeURIComponent(application)}/environments/${encodeURIComponent(environment)}/configurations/${encodeURIComponent(configuration)}`;
			if (flag) {
				const flags = Array.isArray(flag) ? flag : [flag];
				if (flags.length) {
					url += `?${flags
						.map((f) => `flag=${encodeURIComponent(f)}`)
						.join("&")}`;
				}
			}
			values[internalKey] = fetch(url)
				.then((res) => {
					if (!res.ok) {
						throw new Error(`${pkg} ${res.status} ${res.statusText}`, {
							cause: { package: pkg },
						});
					}
					const contentType = res.headers.get("Content-Type") ?? "";
					return jsonContentTypePattern.test(contentType)
						? res.json()
						: res.text();
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

	const appConfigExtensionMiddlewareBefore = async (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			const pending = assignSetToContext(contextSpec, value, request);
			if (pending) await pending;
		}
	};

	return { before: appConfigExtensionMiddlewareBefore };
};

export default appConfigExtensionMiddleware;

// used for TS type inference (see index.d.ts)
export function appConfigExtensionParam(config) {
	return config;
}
