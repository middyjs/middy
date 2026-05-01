// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { canPrefetch, processCache, validateOptions } from "@middy/util";

const name = "dsql";
const pkg = `@middy/${name}`;

const optionSchema = {
	type: "object",
	properties: {
		client: { instanceof: "Function" },
		config: {
			type: "object",
			properties: {
				host: {
					type: "string",
					pattern:
						"^[a-z0-9]+\\.dsql(-[a-z]+)?\\.[a-z]{2}(-[a-z]+){1,2}-\\d+\\.on\\.aws$",
				},
				username: { type: "string" },
				database: { type: "string" },
				region: { type: "string" },
				port: { type: "integer", minimum: 1, maximum: 65535 },
				tokenDurationSecs: { type: "integer", minimum: 1 },
			},
			required: ["host"],
			additionalProperties: true,
		},
		contextKey: { type: "string" },
		disablePrefetch: { type: "boolean" },
		cacheKey: { type: "string" },
		cacheKeyExpiry: {
			type: "object",
			additionalProperties: { type: "number", minimum: -1 },
		},
		cacheExpiry: { type: "number", minimum: -1 },
	},
	required: ["client", "config"],
	additionalProperties: false,
};

export const dsqlValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const defaults = {
	contextKey: name,
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	cacheExpiry: -1,
};

const dsqlMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	if (typeof options.client !== "function") {
		throw new Error("client option missing", { cause: { package: pkg } });
	}

	const fetch = () => options.client(options.config);

	let prefetch;
	if (canPrefetch(options)) {
		prefetch = processCache(options, fetch);
	}

	const dsqlMiddlewareBefore = async (request) => {
		const { value } = prefetch ?? processCache(options, fetch, request);
		Object.assign(request.context, { [options.contextKey]: await value });
	};
	const dsqlMiddlewareAfter = async (request) => {
		// try/catch for if an error is thrown after this ran the first time
		try {
			if (options.cacheExpiry === 0) {
				await request.context[options.contextKey].end();
			}
		} catch (e) {
			console.error(`${pkg}: cleanup error`, e);
		}
	};
	const dsqlMiddlewareOnError = dsqlMiddlewareAfter;

	return {
		before: dsqlMiddlewareBefore,
		after: dsqlMiddlewareAfter,
		onError: dsqlMiddlewareOnError,
	};
};

export default dsqlMiddleware;
