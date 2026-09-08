// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	canPrefetch,
	clearCache,
	getCache,
	getInternal,
	isExecutionModeDurable,
	processCache,
	setContextNamespace,
	validateOptions,
} from "@middy/util";

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
		// @middy/dsql-signer stores the auth token in request.internal as an
		// unresolved Promise; resolve it through getInternal (the standard middy
		// contract) rather than reading request.internal[key] raw, which would
		// hand the driver a Promise as `password` and fail SASL auth.
		const { token } = await getInternal(
			{ token: options.internalKey },
			request,
		);
		if (token === undefined) {
			throw new Error(
				`internalKey '${options.internalKey}' not found; ensure @middy/dsql-signer runs before @middy/dsql`,
				{ cause: { package: pkg } },
			);
		}
		return { ssl: true, ...options.config, password: token };
	};

	const connect = options.internalKey
		? async (request) => options.client(await buildConfig(request))
		: () => options.client({ ssl: true, ...options.config });

	// Clients that leave the cache (replaced by a refresh, superseded after a
	// failed reconnect, or flagged broken) are closed once the invocations
	// holding them finish, so a refresh never kills a running query. Leases are
	// counted per client, so a retired client closes as soon as its own holders
	// release while newer clients stay open.
	const holders = new Map(); // request -> client
	const leases = new Map(); // client -> invocations holding it
	const retired = new Set();
	let live;
	const close = (client) => {
		// Stryker disable next-line CallExpression: equivalent; a client is retired at most once and closed only after its last lease is released (or before any lease exists), so a closed client is never looked up in `retired` again. The delete only frees the reference.
		retired.delete(client);
		Promise.try(() => client.end()).catch((e) => {
			console.error("%s: cleanup error: %s", pkg, e.message);
		});
	};
	const retire = (client) => {
		if (leases.has(client)) {
			retired.add(client);
		} else {
			close(client);
		}
	};
	const lease = (request, client) => {
		holders.set(request, client);
		leases.set(client, (leases.get(client) ?? 0) + 1);
	};
	const release = (request) => {
		const client = holders.get(request);
		// Stryker disable next-line ConditionalExpression: equivalent; with no holder the fall-through only touches `leases` and `retired` with an undefined key, which neither ever holds, so nothing changes.
		if (client === undefined) return;
		holders.delete(request);
		const remaining = leases.get(client) - 1;
		if (remaining > 0) {
			leases.set(client, remaining);
			return;
		}
		leases.delete(client);
		if (retired.has(client)) close(client);
	};
	// Durable execution skips onError, so an invocation that threw never
	// released its lease. Invocations are sequential there, so every lease
	// still held when the next one starts belongs to a finished invocation.
	const reclaim = () => {
		for (const [request, client] of holders) {
			if (options.cacheExpiry === 0) close(client);
			release(request);
		}
	};
	// Make a freshly connected client the one the cache hands out, retiring
	// the previous one.
	const adopt = (client) => {
		if (live !== undefined) retire(live);
		live = client;
		return client;
	};

	const fetch = (request) => {
		const pending = Promise.try(() => connect(request)).then(
			(client) => {
				if (options.cacheExpiry === 0) return client;
				const current = getCache(options.cacheKey).value;
				if (current === undefined || current === pending) {
					return adopt(client);
				}
				// Another connect replaced this entry while it was in flight (a
				// refresh timer, or a broken-client reconnect racing this one).
				// The cache owns that client, so hand it back and close this one;
				// keep this one only if that connect fails.
				return current.then(
					(cached) => {
						retire(client);
						return cached;
					},
					() => adopt(client),
				);
			},
			(e) => {
				// Drop the rejected promise so the next invocation reconnects
				// instead of replaying the failure for the life of the entry.
				clearCache(options.cacheKey);
				throw e;
			},
		);
		return pending;
	};

	if (!options.internalKey && canPrefetch(options)) {
		processCache(options, fetch);
	}

	const dsqlMiddlewareBefore = async (request) => {
		if (isExecutionModeDurable(request?.context)) reclaim();
		const entry = processCache(options, () => fetch(request), request);
		let client = await entry.value;
		if (client.broken) {
			// The adapter flagged an unexpected disconnect: drop the dead client
			// and reconnect now rather than hand it out again. When a concurrent
			// invocation already replaced the entry, join its reconnect instead
			// of starting a second one that would race it for the cache.
			if (
				options.cacheExpiry === 0 ||
				getCache(options.cacheKey).value === entry.value
			) {
				clearCache(options.cacheKey);
				retire(client);
				live = undefined;
			}
			client = await processCache(options, () => fetch(request), request).value;
		}
		setContextNamespace(request, options.contextKey, client);
		lease(request, client);
	};
	const dsqlMiddlewareAfter = async (request) => {
		try {
			if (options.cacheExpiry === 0) {
				await request.context.middyContext?.[options.contextKey].end();
			}
		} catch (e) {
			console.error("%s: cleanup error: %s", pkg, e.message);
		}
		release(request);
	};
	const dsqlMiddlewareOnError = dsqlMiddlewareAfter;

	return {
		before: dsqlMiddlewareBefore,
		after: dsqlMiddlewareAfter,
		onError: dsqlMiddlewareOnError,
	};
};

export default dsqlMiddleware;
