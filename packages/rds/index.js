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
	// `processCache` honours the per-key override first; every lifetime check
	// below must see the same value it does.
	const cacheExpiry =
		options.cacheKeyExpiry?.[options.cacheKey] ?? options.cacheExpiry;
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

	const connect = options.internalKey
		? async (request) => options.client(await buildConfig(request))
		: () => options.client(options.config);

	// Clients that leave the cache (replaced by a refresh, superseded after a
	// failed reconnect, or flagged broken) are closed once the invocations
	// holding them finish, so a refresh never kills a running query. Leases are
	// counted per client, so a retired client closes as soon as its own holders
	// release while newer clients stay open.
	const holders = new Map(); // request -> client
	const leases = new Map(); // client -> { count, retired }
	let live;
	const close = (client) => {
		Promise.try(() => client.end()).catch((e) => {
			console.error("%s: cleanup error: %s", pkg, e.message);
		});
	};
	const retire = (client) => {
		const held = leases.get(client);
		if (held === undefined) close(client);
		else held.retired = true;
	};
	const lease = (request, client) => {
		holders.set(request, client);
		const held = leases.get(client);
		if (held === undefined) leases.set(client, { count: 1, retired: false });
		else held.count += 1;
	};
	const release = (request) => {
		const client = holders.get(request);
		// An invocation whose connect failed holds nothing.
		if (client === undefined) return;
		holders.delete(request);
		const held = leases.get(client);
		held.count -= 1;
		if (held.count > 0) return;
		leases.delete(client);
		if (held.retired) close(client);
	};
	// Durable execution skips onError, so an invocation that threw never
	// released its lease. Invocations are sequential there, so every lease
	// still held when the next one starts belongs to a finished invocation.
	const reclaim = () => {
		for (const [request, client] of holders) {
			if (cacheExpiry === 0) close(client);
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
				if (cacheExpiry === 0) return client;
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
				// instead of replaying the failure for the life of the entry. A
				// connect that already replaced this one (a refresh timer, or a
				// broken-client reconnect racing it) owns the entry: leave it.
				if (getCache(options.cacheKey).value === pending) {
					clearCache(options.cacheKey);
				}
				throw e;
			},
		);
		return pending;
	};

	if (!options.internalKey && canPrefetch({ ...options, cacheExpiry })) {
		processCache(options, fetch);
	}

	// Under `internalKey` a background refresh could only reconnect with the
	// token of the invocation that stored the entry, stale by then. Let the
	// entry expire instead; the next invocation reconnects with its own token.
	const connectCached = (request) => {
		const entry = processCache(options, () => fetch(request), request);
		if (options.internalKey) clearTimeout(getCache(options.cacheKey).refresh);
		return entry;
	};

	const rdsMiddlewareBefore = async (request) => {
		if (isExecutionModeDurable(request?.context)) reclaim();
		const entry = connectCached(request);
		let client = await entry.value;
		if (client.broken) {
			// The adapter flagged an unexpected disconnect: drop the dead client
			// and reconnect now rather than hand it out again. When a concurrent
			// invocation already replaced the entry, join its reconnect instead
			// of starting a second one that would race it for the cache.
			if (
				cacheExpiry === 0 ||
				getCache(options.cacheKey).value === entry.value
			) {
				clearCache(options.cacheKey);
				retire(client);
				live = undefined;
			}
			client = await connectCached(request).value;
		}
		setContextNamespace(request, options.contextKey, client);
		lease(request, client);
	};
	const rdsMiddlewareAfter = async (request) => {
		try {
			if (cacheExpiry === 0) {
				await request.context.middyContext?.[options.contextKey]?.end();
			}
		} catch (e) {
			console.error("%s: cleanup error: %s", pkg, e.message);
		}
		release(request);
	};
	const rdsMiddlewareOnError = rdsMiddlewareAfter;

	return {
		before: rdsMiddlewareBefore,
		after: rdsMiddlewareAfter,
		onError: rdsMiddlewareOnError,
	};
};

export default rdsMiddleware;
