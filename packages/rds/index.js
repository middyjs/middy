// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	canPrefetch,
	getInternal,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "rds";
const pkg = `@middy/${name}`;

const optionSchema = {
	type: "object",
	properties: {
		client: { instanceof: "Function" },
		config: {
			type: "object",
			properties: {
				host: { type: "string" },
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

export const rdsValidateOptions = (options) =>
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

const rdsMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	if (options.internalKey && opts.cacheExpiry === undefined) {
		options.cacheExpiry = 0;
	}
	if (typeof options.client !== "function") {
		throw new Error(
			options.client === undefined
				? "client option missing"
				: "client must be a function",
			{ cause: { package: pkg } },
		);
	}

	const buildConfig = async (request) => {
		// @middy/rds-signer stores the auth token in request.internal as an
		// unresolved Promise; resolve it through getInternal (the standard middy
		// contract) rather than reading request.internal[key] raw, which would
		// hand pg/postgres a Promise as `password` and fail SASL auth.
		const { token } = await getInternal(
			{ token: options.internalKey },
			request,
		);
		if (token === undefined) {
			throw new Error(
				`internalKey '${options.internalKey}' not found; ensure @middy/rds-signer runs before @middy/rds`,
				{ cause: { package: pkg } },
			);
		}
		return { ...options.config, password: token };
	};

	const fetch = options.internalKey
		? async (request) => options.client(await buildConfig(request))
		: (request) => options.client(options.config);

	if (!options.internalKey && canPrefetch(options)) {
		processCache(options, fetch);
	}

	const rdsMiddlewareBefore = async (request) => {
		const { value } = processCache(options, () => fetch(request), request);
		const resolved = await value;
		Object.assign(request.context, { [options.contextKey]: resolved });
	};
	const rdsMiddlewareAfter = async (request) => {
		try {
			if (options.cacheExpiry === 0) {
				await request.context[options.contextKey].end();
			}
		} catch (e) {
			console.error("%s: cleanup error: %s", pkg, e.message);
		}
	};
	const rdsMiddlewareOnError = rdsMiddlewareAfter;

	return {
		before: rdsMiddlewareBefore,
		after: rdsMiddlewareAfter,
		onError: rdsMiddlewareOnError,
	};
};

export default rdsMiddleware;
