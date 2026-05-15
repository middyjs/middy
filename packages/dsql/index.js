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
				port: { type: "integer", minimum: 1, maximum: 65535 },
			},
			required: ["host"],
			additionalProperties: true,
		},
		contextKey: { type: "string" },
		internalKey: { type: "string" },
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
	client: undefined,
	config: undefined,
	contextKey: name,
	internalKey: undefined,
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	cacheExpiry: -1,
};

const dsqlMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	if (typeof options.client !== "function") {
		throw new Error(
			options.client === undefined
				? "client option missing"
				: "client must be a function",
			{ cause: { package: pkg } },
		);
	}

	const buildConfig = (request) => {
		const config = { ssl: true, ...options.config };
		if (!options.internalKey) return config;
		const token = request?.internal?.[options.internalKey];
		if (token === undefined) {
			throw new Error(
				`internalKey '${options.internalKey}' not found; ensure @middy/dsql-signer runs before @middy/dsql`,
				{ cause: { package: pkg } },
			);
		}
		return { ...config, password: token };
	};

	const fetch = (request) => options.client(buildConfig(request));

	let prefetch;
	if (!options.internalKey && canPrefetch(options)) {
		prefetch = processCache(options, fetch);
	}

	const dsqlMiddlewareBefore = async (request) => {
		const { value } =
			prefetch ?? processCache(options, () => fetch(request), request);
		Object.assign(request.context, { [options.contextKey]: await value });
	};
	const dsqlMiddlewareAfter = async (request) => {
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
