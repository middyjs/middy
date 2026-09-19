// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

// Option validation helper.
// Schema values:
//   'string' | 'number' | 'integer' | 'boolean' | 'function' | 'object' | 'array'
//     Trailing '?' marks the field as optional (may be undefined).
//   (value) => boolean predicate - only called when value is not undefined
//     (i.e. predicates treat the field as optional by design).
//   { type: 'array' | 'array?', items: <itemSchema> }
//     `items` is applied to each array element. It can be a type string,
//     a predicate function, or a plain object treated as a per-element
//     object schema (validated recursively with the same rules).
//   { type: '<type>' | '<type>?', minimum?, maximum?, exclusiveMinimum?,
//     minLength?, maxLength?, pattern? }
//     Numeric: `minimum`/`maximum` (inclusive), `exclusiveMinimum`
//     (exclusive).
//     String: `minLength`/`maxLength` (string length), `pattern` (regex
//     source string per JSON Schema).
//   { type: 'object' | 'object?', properties?: {...}, additionalProperties?: <rule> }
//     `properties` validates known keys with the flat-schema form.
//     `additionalProperties` validates every other key's value against the
//     given rule (string, predicate, or nested object schema). Without it,
//     unknown keys throw.
//   { enum: [...values], type?: '<type>' | '<type>?' }
//     Value must strict-equal one of the listed values. Optional by default;
//     combine with `type` to require a specific type and/or presence.
// Keys in `options` (or nested objects) that are not in `schema` throw,
// catching typos.

const name = "util";
const pkg = `@middy/${name}`;

const validateOptionsTypeCheckers = {
	string: (v) => typeof v === "string",
	number: (v) => typeof v === "number" && !Number.isNaN(v),
	integer: (v) => Number.isInteger(v),
	boolean: (v) => typeof v === "boolean",
	function: (v) => typeof v === "function",
	object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
	array: (v) => Array.isArray(v),
};

const isPlainObject = (v) =>
	v !== null && typeof v === "object" && !Array.isArray(v);

const checkSchemaObject = (schema, options, path, fail) => {
	if (!isPlainObject(options)) {
		fail(
			path ? `Option '${path}' must be object` : "options must be an object",
		);
	}
	for (const key of Object.keys(options)) {
		if (!Object.hasOwn(schema, key)) {
			fail(`Unknown option '${path ? `${path}.${key}` : key}'`);
		}
	}
	for (const key of Object.keys(schema)) {
		const childPath = path ? `${path}.${key}` : key;
		checkRule(schema[key], options[key], childPath, fail);
	}
};

// Returns true if type check passed (and value is defined), false if the
// caller should stop validating (value was undefined and optional).
const checkTypeSpec = (rawType, value, path, fail) => {
	const optional = rawType.endsWith("?");
	const type = optional ? rawType.slice(0, -1) : rawType;
	const checker = validateOptionsTypeCheckers[type];
	if (!checker)
		schemaFail(`Unknown schema type '${type}' for option '${path}'`);
	if (value === undefined) {
		if (!optional) fail(`Missing required option '${path}' (${type})`);
		return false;
	}
	if (!checker(value)) fail(`Option '${path}' must be ${type}`);
	return true;
};

// Plain object with no rule-marker key (`type`, `enum`, `oneOf`, `allOf`,
// `const`, `instanceof`) is a flat object schema; anything else is a rule.
// Used when dispatching `items` and `additionalProperties`.
const checkNestedRule = (rule, value, path, fail) => {
	if (
		isPlainObject(rule) &&
		typeof rule.type !== "string" &&
		!Array.isArray(rule.enum) &&
		!Array.isArray(rule.oneOf) &&
		!Array.isArray(rule.allOf) &&
		!Object.hasOwn(rule, "const") &&
		typeof rule.instanceof !== "string"
	) {
		checkSchemaObject(rule, value, path, fail);
	} else {
		checkRule(rule, value, path, fail);
	}
};

const childPathOf = (path, key) => (path ? `${path}.${key}` : key);

class SchemaError extends Error {}
const schemaFail = (message) => {
	throw new SchemaError(message);
};

// Stable JSON form: recursively sorts object keys, skips function-typed
// values. Used for `uniqueItems` so items that differ only by handler
// identity or key ordering collide.
const stableStringify = (value, seen = new WeakSet()) => {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (seen.has(value)) return '"[Circular]"';
	seen.add(value);
	const isArray = Array.isArray(value);
	const parts = isArray
		? value.map((v) => stableStringify(v, seen))
		: Object.keys(value)
				.filter((k) => typeof value[k] !== "function")
				.sort()
				.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k], seen)}`);
	seen.delete(value);
	const joined = parts.join(",");
	return isArray ? `[${joined}]` : `{${joined}}`;
};

const resolveInstance = (name) => {
	const ctor = globalThis[name];
	if (typeof ctor !== "function") {
		schemaFail(`Unknown 'instanceof' class '${name}'`);
	}
	return ctor;
};

const checkRule = (rule, value, path, fail) => {
	if (typeof rule === "function") {
		if (value !== undefined && !rule(value)) {
			fail(`Invalid option '${path}'`);
		}
		return;
	}
	if (typeof rule === "string") {
		checkTypeSpec(rule, value, path, fail);
		return;
	}
	if (isPlainObject(rule) && Object.hasOwn(rule, "const")) {
		if (value === undefined) return;
		if (value !== rule.const) {
			fail(`Option '${path}' must equal ${JSON.stringify(rule.const)}`);
		}
		return;
	}
	if (isPlainObject(rule) && Array.isArray(rule.allOf)) {
		if (value === undefined) return;
		for (const sub of rule.allOf) {
			checkRule(sub, value, path, fail);
		}
		return;
	}
	if (isPlainObject(rule) && Array.isArray(rule.oneOf)) {
		if (value === undefined) return;
		let matches = 0;
		for (const sub of rule.oneOf) {
			try {
				checkRule(sub, value, path, (msg) => {
					throw new TypeError(msg);
				});
				matches++;
			} catch (e) {
				if (e instanceof SchemaError) throw e;
			}
		}
		if (matches !== 1) {
			fail(`Option '${path}' must match exactly one schema in oneOf`);
		}
		return;
	}
	if (isPlainObject(rule) && typeof rule.instanceof === "string") {
		if (value === undefined) return;
		const ctor = resolveInstance(rule.instanceof);
		if (!(value instanceof ctor)) {
			fail(`Option '${path}' must be instanceof ${rule.instanceof}`);
		}
		return;
	}
	if (isPlainObject(rule) && Array.isArray(rule.enum)) {
		if (typeof rule.type === "string") {
			if (!checkTypeSpec(rule.type, value, path, fail)) return;
		} else if (value === undefined) {
			return;
		}
		if (!rule.enum.includes(value)) {
			fail(`Option '${path}' must be one of ${JSON.stringify(rule.enum)}`);
		}
		return;
	}
	if (isPlainObject(rule) && typeof rule.type === "string") {
		const {
			type: rawType,
			items,
			uniqueItems,
			properties,
			required,
			additionalProperties,
			minimum,
			maximum,
			exclusiveMinimum,
			pattern,
			minLength,
			maxLength,
		} = rule;
		if (!checkTypeSpec(rawType, value, path, fail)) return;
		const type = rawType.endsWith("?") ? rawType.slice(0, -1) : rawType;
		if (value < minimum) {
			fail(`Option '${path}' must be >= ${minimum}`);
		}
		if (value > maximum) {
			fail(`Option '${path}' must be <= ${maximum}`);
		}
		if (value <= exclusiveMinimum) {
			fail(`Option '${path}' must be > ${exclusiveMinimum}`);
		}
		const hasStringConstraint =
			pattern !== undefined ||
			minLength !== undefined ||
			maxLength !== undefined;
		if (hasStringConstraint && typeof value !== "string") {
			fail(`Option '${path}' must be string`);
		}
		if (pattern !== undefined) {
			let matched;
			try {
				matched = value.match(pattern) !== null;
			} catch {
				// A pattern that does not compile is a malformed schema, not a
				// mismatch; the RegExp SyntaxError is surfaced as the packaged
				// TypeError like every other schema error.
				schemaFail(`Invalid pattern for option '${path}'`);
			}
			if (!matched) fail(`Option '${path}' must match pattern ${pattern}`);
		}
		if (value.length < minLength) {
			fail(`Option '${path}' must have length >= ${minLength}`);
		}
		if (value.length > maxLength) {
			fail(`Option '${path}' must have length <= ${maxLength}`);
		}
		if (type === "array" && items !== undefined) {
			for (let i = 0; i < value.length; i++) {
				checkNestedRule(items, value[i], `${path}[${i}]`, fail);
			}
		}
		if (type === "array" && uniqueItems === true) {
			const seen = new Set();
			for (let i = 0; i < value.length; i++) {
				const key = stableStringify(value[i]);
				if (seen.has(key)) {
					fail(`Duplicate item at '${path}[${i}]'`);
				}
				seen.add(key);
			}
		}
		if (type === "object" && Array.isArray(required)) {
			for (const key of required) {
				if (value[key] === undefined) {
					fail(`Missing required option '${childPathOf(path, key)}'`);
				}
			}
		}
		if (
			type === "object" &&
			(properties || additionalProperties !== undefined)
		) {
			for (const key of Object.keys(value)) {
				if (properties && Object.hasOwn(properties, key)) continue;
				if (
					additionalProperties === undefined ||
					additionalProperties === false
				) {
					fail(`Unknown option '${childPathOf(path, key)}'`);
				}
				if (additionalProperties === true) continue;
				checkNestedRule(
					additionalProperties,
					value[key],
					childPathOf(path, key),
					fail,
				);
			}
			if (properties) {
				for (const key of Object.keys(properties)) {
					if (value[key] === undefined) continue;
					checkRule(properties[key], value[key], childPathOf(path, key), fail);
				}
			}
		}
		return;
	}
	schemaFail(`Invalid schema for option '${path}'`);
};

const isJsonSchemaForm = (schema) =>
	isPlainObject(schema) &&
	schema.type === "object" &&
	(Object.hasOwn(schema, "properties") ||
		Object.hasOwn(schema, "required") ||
		Object.hasOwn(schema, "additionalProperties"));

export const validateOptions = (packageName, schema, options = {}) => {
	const fail = (message) => {
		throw new TypeError(message, { cause: { package: packageName } });
	};
	try {
		if (isJsonSchemaForm(schema)) {
			checkRule(schema, options, "", fail);
		} else {
			checkSchemaObject(schema, options, "", fail);
		}
	} catch (e) {
		// Re-wrap an internal malformed-schema `SchemaError` so callers still see
		// the documented `TypeError` + `cause.package`; mismatch errors already
		// carry that shape and pass through untouched, as does an error a
		// predicate threw.
		if (e instanceof SchemaError) {
			fail(e.message);
		}
		throw e;
	}
	return options;
};

export const createPrefetchClient = (options) => {
	const { awsClientOptions } = options;
	const client = new options.AwsClient(awsClientOptions);

	// AWS XRay
	if (options.awsClientCapture) {
		if (options.disablePrefetch) {
			return options.awsClientCapture(client);
		}
		console.warn("Unable to apply X-Ray outside of handler invocation scope.");
	}

	return client;
};

export const createClient = async (options, request) => {
	let awsClientCredentials = {};

	// Role Credentials
	if (options.awsClientAssumeRole) {
		// The credentials live in `request.internal`; without it the client would
		// silently be built on the function's own role.
		if (!request?.internal) {
			throw new Error("Request required when assuming role", {
				cause: { package: pkg },
			});
		}
		awsClientCredentials = await getInternal(
			{ credentials: options.awsClientAssumeRole },
			request,
		);
	}

	awsClientCredentials = {
		...awsClientCredentials,
		...options.awsClientOptions,
	};

	return createPrefetchClient({
		...options,
		awsClientOptions: awsClientCredentials,
	});
};

// Memoized client initialisation for the warm path. A rejected attempt is
// forgotten so the next invocation retries instead of replaying the same
// failure for the life of the container. With `awsClientAssumeRole` the memo
// is keyed on the credential value sts stored in `request.internal` (the same
// promise object until sts refetches), so refreshed credentials rebuild the
// client instead of it keeping the first invocation's, by then expired, session.
export const createClientInit = (options) => {
	const { awsClientAssumeRole } = options;
	let pending;
	let credentials;
	return (request) => {
		// A request without `internal` is left to createClient, which rejects
		// with the packaged error rather than throwing here synchronously.
		// Without awsClientAssumeRole the key is undefined, the read yields
		// undefined on every request and the memo is never reset.
		const current = request?.internal?.[awsClientAssumeRole];
		if (current !== credentials) {
			credentials = current;
			pending = undefined;
		}
		if (pending === undefined) {
			// Only the current attempt is forgotten on failure: one superseded by
			// refetched credentials may still reject after its replacement began.
			const attempt = createClient(options, request).catch((e) => {
				if (pending === attempt) pending = undefined;
				throw e;
			});
			pending = attempt;
		}
		return pending;
	};
};

export const canPrefetch = (options = {}) => {
	return (
		!options.awsClientAssumeRole &&
		!options.disablePrefetch &&
		options.cacheExpiry !== 0
	);
};

const safeGet = (obj, key) =>
	obj != null && Object.hasOwn(obj, key) ? obj[key] : undefined;

// `sanitizeKey` maps e.g. `a.b`, `a_b` and `a-b` all to `a_b`, so two
// requested keys can land on the same output name and one value would
// silently overwrite the other. Callers detect the collision on write (an
// `in` check against the null-prototype output) and build the error here,
// off the hot path, listing every requested key that collides.
const duplicateSanitizedKeyError = (keys, sanitized) => {
	const collisions = keys.filter((key) => sanitizeKey(key) === sanitized);
	return new TypeError(
		`Keys ${collisions.map((key) => `"${key}"`).join(", ")} sanitize to the same name "${sanitized}"`,
		{ cause: { package: pkg, data: { keys: collisions } } },
	);
};

// Internal Context
export const getInternal = async (variables, request) => {
	if (!variables || !request?.internal) return Object.create(null);
	let keys;
	let values;
	if (variables === true) {
		keys = values = Object.keys(request.internal);
	} else if (typeof variables === "string") {
		keys = values = [variables];
	} else if (Array.isArray(variables)) {
		keys = values = variables;
	} else if (typeof variables === "object") {
		keys = Object.keys(variables);
		values = Object.values(variables);
	} else {
		return Object.create(null);
	}
	// Fast synchronous path: when every internal value is already resolved
	// (warm/cached invocations) the result is built without any Promise
	// machinery, so the returned promise is already settled and an `await` on
	// it costs no extra microtask hop. The first pending value hands over to
	// the async fallback below, which produces the same output.
	const obj = Object.create(null);
	let allSync = true;
	for (let i = 0; i < values.length; i++) {
		const internalKey = values[i];
		const dotIndex = internalKey.indexOf(".");
		const rootKey =
			dotIndex === -1 ? internalKey : internalKey.substring(0, dotIndex);
		let value = request.internal[rootKey];
		if (isPromise(value)) {
			allSync = false;
			break;
		}
		if (dotIndex !== -1) {
			for (const part of internalKey.substring(dotIndex + 1).split(".")) {
				value = safeGet(value, part);
			}
			if (isPromise(value)) {
				allSync = false;
				break;
			}
		}
		const sanitized = sanitizeKey(keys[i]);
		if (sanitized in obj) throw duplicateSanitizedKeyError(keys, sanitized);
		obj[sanitized] = value;
	}
	if (allSync) return obj;

	// Async fallback: for cold/first invocations with pending promises
	const promises = [];
	for (const internalKey of values) {
		// 'internal.key.sub_value' -> { [key]: internal.key.sub_value }
		const pathOptionKey = internalKey.split(".");
		const rootOptionKey = pathOptionKey.shift();
		// Promise.resolve hands a native promise back unchanged, so a resolved
		// value and a pending one take the same path.
		promises.push(
			Promise.resolve(request.internal[rootOptionKey]).then((value) =>
				pathOptionKey.reduce(safeGet, value),
			),
		);
	}
	// ensure promise has resolved by the time it's needed
	// If one of the promises throws it will bubble up to @middy/core
	values = await Promise.allSettled(promises);
	const resolved = Object.create(null);
	let errors;
	for (let i = 0; i < keys.length; i++) {
		if (values[i].status === "rejected") {
			errors ??= [];
			errors.push(values[i].reason);
		} else {
			const sanitized = sanitizeKey(keys[i]);
			if (sanitized in resolved) {
				throw duplicateSanitizedKeyError(keys, sanitized);
			}
			resolved[sanitized] = values[i].value;
		}
	}
	if (errors) {
		throw new AggregateError(errors, "Failed to resolve internal values", {
			cause: { package: pkg },
		});
	}
	return resolved;
};

const isPromise = (promise) => typeof promise?.then === "function";

const sanitizeKeyPrefixLeadingNumber = /^([0-9])/;
const sanitizeKeyRemoveDisallowedChar = /[^a-zA-Z0-9]+/g;
const sanitizeKeyCache = new Map();
const sanitizeKeyCacheMaxSize = 1024;
export const sanitizeKey = (key) => {
	let sanitized = sanitizeKeyCache.get(key);
	if (sanitized === undefined) {
		sanitized = key
			.replace(sanitizeKeyPrefixLeadingNumber, "_$1")
			.replace(sanitizeKeyRemoveDisallowedChar, "_");
		// Flushed when full rather than frozen, so a container that sees more
		// distinct keys than the cap keeps memoizing the recent ones.
		// ponytail: whole-cache flush, swap for LRU if the recompute bursts matter.
		if (sanitizeKeyCache.size === sanitizeKeyCacheMaxSize) {
			sanitizeKeyCache.clear();
		}
		sanitizeKeyCache.set(key, sanitized);
	}
	return sanitized;
};

// Resolve the API Gateway / VPC Lattice event "version" used by the HTTP
// router and event normalizer to dispatch event-shape handling:
//   - explicit `event.version` ("1.0" | "2.0") wins
//   - otherwise a VPC Lattice event (identified by `event.method`) -> "vpc"
//   - else default to "1.0" (the safer default)
export const resolveHttpEventVersion = (event) => {
	// '1.0' is a safer default
	return event.version ?? (event.method ? "vpc" : "1.0");
};

// Handler-facing namespace on the Lambda context.
//
// Middleware publish to `context.middyContext[contextKey]` (contextKey defaults to
// the package name without the `@middy/` scope) instead of the context root,
// so a fetched value named `functionName` can't clobber the AWS context.
// `@middy/core` seeds `context.middyContext` per invocation; the `??=` here keeps a
// hand-rolled request that never passed through core working, and keeps the
// null prototype, which matters because keys come from user config and on a
// plain object a key of `__proto__` would set the prototype instead of an own
// property.
const contextRoot = (request) =>
	(request.context.middyContext ??= Object.create(null));

// Get-or-create the merge target for key/value data (`setToContext`), so two
// middleware sharing one contextKey merge rather than clobber.
export const contextNamespace = (request, contextKey) =>
	(contextRoot(request)[contextKey] ??= Object.create(null));

// Publish a single opaque value (a client, a pool, a verified payload).
export const setContextNamespace = (request, contextKey, value) => {
	contextRoot(request)[contextKey] = value;
};

// setToContext fast-path
//
// Many middlewares (kms/ssm/secrets-manager/dynamodb/s3/sts/…) follow the
// same pattern: after `processCache` resolves `value`, when `setToContext`
// is set they re-`await getInternal(fetchDataKeys, request)` solely to copy
// the same values to `request.context` under sanitized key names. On warm
// invocations every entry in `value` is already resolved, so the extra
// await + per-key regex + null-prototype-object allocation in `getInternal`
// is dead work.
//
// `buildSetToContextSpec(options)` is called once at factory time and
// returns either `null` (when `setToContext` is false) or the target
// `contextKey` plus the precomputed `[[originalKey, sanitizedKey], …]` pairs.
// Either way it rejects two `fetchData` keys that sanitize to the same name up
// front: with `setToContext` off they still collide in `request.internal`,
// where `getInternal` would throw on every invocation instead of once here.
//
// `assignSetToContext(spec, value, request)` is called once per invocation.
// Returns `undefined` synchronously when all entries are resolved (the
// common warm path), or a Promise when at least one is still pending. The
// caller should `if (p) await p` so the sync path keeps zero microtask hops.
export const buildSetToContextSpec = (options) => {
	const keys = Object.keys(options.fetchData);
	const pairs = [];
	const seen = new Set();
	for (const key of keys) {
		const sanitized = sanitizeKey(key);
		if (seen.has(sanitized)) throw duplicateSanitizedKeyError(keys, sanitized);
		seen.add(sanitized);
		pairs.push([key, sanitized]);
	}
	if (!options.setToContext) return null;
	return { contextKey: options.contextKey, pairs };
};

export const assignSetToContext = ({ contextKey, pairs }, value, request) => {
	for (let i = 0; i < pairs.length; i++) {
		const v = value[pairs[i][0]];
		if (typeof v?.then === "function") {
			// Cold path: at least one value still pending; defer to
			// `getInternal` for the standard await+sanitize+assign flow.
			return getInternal(
				pairs.map((pair) => pair[0]),
				request,
			).then((data) => {
				Object.assign(contextNamespace(request, contextKey), data);
			});
		}
	}
	const ctx = contextNamespace(request, contextKey);
	for (let i = 0; i < pairs.length; i++) {
		ctx[pairs[i][1]] = value[pairs[i][0]];
	}
};

// fetch Cache
// Map keyed by cacheKey; value shape: { value:{fetchKey:Promise}, expiry, refresh?, modified? }
// Map chosen over plain object so deletion is O(1), frees the key slot, and
// avoids the `delete` operator (biome's performance/noDelete rule).
const cache = new Map();
const defaultCacheMaxSize = 128;

const validateCacheExpiry = (cacheExpiry) => {
	if (cacheExpiry == null) return;
	if (!Number.isInteger(cacheExpiry) || cacheExpiry < -1) {
		throw new Error(
			`Invalid cacheExpiry value: ${cacheExpiry}. Must be -1 (infinite), 0 (disabled), or a positive integer (ms duration or unix timestamp)`,
			{ cause: { package: pkg } },
		);
	}
};

// Attach a no-op rejection handler to any promise(s) a fetch returns. A prefetch
// (warm-up) result is stored but not awaited until a later invocation, so without
// this an early rejection would surface as an unhandledRejection. The original
// promise is left in place, so the eventual `await` still observes the error.
const silenceFetchRejections = (value) => {
	if (value instanceof Promise) {
		value.catch(() => {});
	} else if (value !== null && typeof value === "object") {
		for (const key of Object.keys(value)) {
			if (value[key] instanceof Promise) value[key].catch(() => {});
		}
	}
};

// setTimeout clamps delays above 2^31-1 ms (~24.8 days) to 1 ms and emits
// TimeoutOverflowWarning, so a refresh that far out is not scheduled at all
// (this also covers the Infinity duration of a `-1` cacheExpiry). The entry
// still expires on time, because expiry is checked on every read; it is just
// refetched on the first request after expiry instead of in the background.
const maxTimeoutDuration = 2147483647;

// Module-scope so the warm cache-hit path allocates no closure; only the
// scheduling paths (modified entry, miss) create the timer callback.
const scheduleRefresh = (
	duration,
	options,
	middlewareFetch,
	middlewareFetchRequest,
) =>
	duration > 0 && duration <= maxTimeoutDuration
		? setTimeout(
				() => processCache(options, middlewareFetch, middlewareFetchRequest),
				duration,
			).unref()
		: undefined;

// Absolute expiry learned for `cacheKey` (see setCacheKeyExpiry), or Infinity
// when there is none.
const learnedExpiry = (options, cacheKey) =>
	options.cacheLearnedExpiry?.[cacheKey] ?? Number.POSITIVE_INFINITY;

export const processCache = (
	options,
	middlewareFetch = () => undefined,
	middlewareFetchRequest = {},
) => {
	let { cacheKey, cacheKeyExpiry, cacheExpiry, cacheMaxSize } = options;
	cacheMaxSize ??= defaultCacheMaxSize;
	cacheExpiry = cacheKeyExpiry?.[cacheKey] ?? cacheExpiry;
	validateCacheExpiry(cacheExpiry);
	const now = Date.now();
	if (cacheExpiry) {
		const cached = getCache(cacheKey);
		// A unix-timestamp cacheExpiry is re-read on every call so a changed
		// option takes effect; a duration or -1 relies on the expiry stored with
		// the entry. Either is capped by the learned expiry, which a fetch may
		// have set after the entry was stored (once its promise resolved).
		const effectiveExpiry = Math.min(
			cacheExpiry > 86400000 ? cacheExpiry : cached.expiry,
			learnedExpiry(options, cacheKey),
		);
		const unexpired = cached.expiry && effectiveExpiry > now;

		if (unexpired) {
			if (cached.modified) {
				const value = middlewareFetch(middlewareFetchRequest, cached.value);
				silenceFetchRejections(value);
				Object.assign(cached.value, value);
				const refresh = scheduleRefresh(
					effectiveExpiry - now,
					options,
					middlewareFetch,
					middlewareFetchRequest,
				);
				const entry = {
					value: cached.value,
					expiry: effectiveExpiry,
					refresh,
					middlewareFetch,
					middlewareFetchRequest,
				};
				cache.set(cacheKey, entry);
				return entry;
			}
			cached.cache = true;
			return cached;
		}
	}
	// The expiry learned by the previous cycle is dropped before the fetch: still
	// ahead of the clock (the entry was cleared, evicted or capped by a shorter
	// cacheExpiry), it would floor whatever this cycle learns and pin every
	// later cycle to the first one's expiry.
	if (options.cacheLearnedExpiry)
		options.cacheLearnedExpiry[cacheKey] = undefined;
	const value = middlewareFetch(middlewareFetchRequest);
	silenceFetchRejections(value);
	// cacheExpiry semantics:
	//   >86400000 (24h): treated as unix timestamp (ms)
	//   >0 && <=86400000: treated as duration (ms) from now
	//   -1: infinite cache (never expires)
	//   0/undefined/null: no caching
	let expiry =
		cacheExpiry < 0
			? Number.POSITIVE_INFINITY
			: cacheExpiry > 86400000
				? cacheExpiry
				: now + cacheExpiry;
	if (cacheExpiry) {
		// Read after the fetch, which may have learned the expiry synchronously,
		// so the entry and its refresh fold it in from the start. One that has
		// already passed (it is what expired the previous entry) is dropped:
		// applied, it would pin the new entry to the past, so every caller in
		// the same tick would refetch and no refresh could be scheduled.
		const learned = learnedExpiry(options, cacheKey);
		if (learned > now) {
			expiry = Math.min(expiry, learned);
		} else {
			options.cacheLearnedExpiry[cacheKey] = undefined;
		}
		clearTimeout(cache.get(cacheKey)?.refresh);
		const refresh = scheduleRefresh(
			expiry - now,
			options,
			middlewareFetch,
			middlewareFetchRequest,
		);
		// The fetch and request are kept so an expiry learned once the fetch
		// resolves (see setCacheKeyExpiry) can reschedule this refresh.
		cache.set(cacheKey, {
			value,
			expiry,
			refresh,
			middlewareFetch,
			middlewareFetchRequest,
		});
		evictCache(cacheMaxSize);
	}
	return { value, expiry };
};

export const catchInvalidSignatureException = (e, client, command) => {
	if (e.__type === "InvalidSignatureException") {
		return client.send(command);
	}
	throw e;
};

export const getCache = (key) => {
	return cache.get(key) ?? {};
};

// Used to remove parts of a cache
export const modifyCache = (cacheKey, value) => {
	const entry = cache.get(cacheKey);
	if (!entry) return;
	clearTimeout(entry.refresh);
	entry.value = value;
	entry.modified = true;
};

// `.catch` handler for a per-key fetch: drop the failed key from the cached
// value and flag the entry modified so the next `processCache` call refetches
// only that key, then rethrow so the current invocation still fails.
// `values` is the object the fetch returned. Given, the key is only dropped
// while the entry still holds that fetch's promise for it: a fetch that fails
// after its entry expired and a newer cycle replaced it must not evict the
// fresh value. The promise is compared rather than the object because the
// modified path merges a refetch into the entry's existing value object.
export const evictCacheOnFailure = (cacheKey, internalKey, values) => (e) => {
	const value = getCache(cacheKey).value ?? {};
	if (values === undefined || value[internalKey] === values[internalKey]) {
		value[internalKey] = undefined;
		modifyCache(cacheKey, value);
	}
	throw e;
};

// Record an absolute expiry (unix ms) learned from a fetched value (credential
// `Expiration`, token lifetime, rotation date). It lives in
// `options.cacheLearnedExpiry`, apart from the user-facing `cacheKeyExpiry`,
// and `processCache` only ever uses it to shorten the configured lifetime: it
// can neither enable caching that is disabled (0) nor extend a shorter
// `cacheExpiry`. Several keys fetched in one cycle keep the earliest expiry,
// while one left by an earlier cycle (already past) is ignored. A value that
// is not a unix timestamp (Infinity for "no expiry", NaN, a duration, a
// negative number) carries no information: it never displaces a fresh learned
// expiry and clears a stale one.
// A fetch usually learns inside its `.then`, after `processCache` stored the
// entry with the configured lifetime and scheduled the refresh for it. When
// the learned expiry shortens that entry, its refresh is moved up to match, so
// the rotation is paid in the background rather than by the first request
// after it. Nothing is scheduled when this caller has caching disabled: an
// entry found under the key then belongs to another instance.
export const setCacheKeyExpiry = (options, expiryMs) => {
	const { cacheKey } = options;
	const now = Date.now();
	const existing = options.cacheLearnedExpiry?.[cacheKey];
	const floor = existing > now ? existing : Number.POSITIVE_INFINITY;
	const learned =
		Number.isFinite(expiryMs) && expiryMs > 86400000
			? Math.floor(expiryMs)
			: Number.POSITIVE_INFINITY;
	const clamp = Math.min(learned, floor);
	options.cacheLearnedExpiry ??= {};
	options.cacheLearnedExpiry[cacheKey] =
		clamp === Number.POSITIVE_INFINITY ? undefined : clamp;
	const entry = cache.get(cacheKey);
	if (
		entry &&
		clamp < entry.expiry &&
		(options.cacheKeyExpiry?.[cacheKey] ?? options.cacheExpiry)
	) {
		clearTimeout(entry.refresh);
		entry.expiry = clamp;
		entry.refresh = scheduleRefresh(
			clamp - now,
			options,
			entry.middlewareFetch,
			entry.middlewareFetchRequest,
		);
	}
};

const evictCache = (maxSize) => {
	if (cache.size <= maxSize) return;
	// Seeded from the first entry, so a cache of nothing but never-expiring
	// entries still evicts the oldest inserted one.
	let [oldestKey, oldest] = cache.entries().next().value;
	for (const [key, entry] of cache) {
		if (entry.expiry < oldest.expiry) {
			oldestKey = key;
			oldest = entry;
		}
	}
	clearTimeout(oldest.refresh);
	cache.delete(oldestKey);
};

export const clearCache = (inputKeys = null) => {
	let keys = inputKeys;
	keys ??= [...cache.keys()];
	if (!Array.isArray(keys)) {
		keys = [keys];
	}
	for (const cacheKey of keys) {
		clearTimeout(cache.get(cacheKey)?.refresh);
		cache.delete(cacheKey);
	}
};

// context
// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html
// `tenantId` is documented under tenant isolation:
// https://docs.aws.amazon.com/lambda/latest/dg/tenant-isolation-context.html
export const lambdaContextKeys = [
	"functionName",
	"functionVersion",
	"invokedFunctionArn",
	"memoryLimitInMB",
	"awsRequestId",
	"logGroupName",
	"logStreamName",
	"identity",
	"clientContext",
	"tenantId",
];

const durableContextBrand = Symbol.for(
	"@aws/durable-execution-sdk-js/durable-context",
);
export const isExecutionModeDurable = (context) => {
	return context?.[durableContextBrand] === true;
};

export const jsonSafeParse = (text, reviver) => {
	if (typeof text !== "string") return text;
	const firstChar = text[0];
	if (firstChar !== "{" && firstChar !== "[" && firstChar !== '"') return text;
	try {
		return JSON.parse(text, reviver);
	} catch {
		return text;
	}
};

// A forbidden key only reaches the guard reviver if it is spelled in the raw
// source, so a body carrying neither spelling skips the per-key callback and
// lets JSON.parse stay on its native path (~8x). Each character matches either
// literally or as the \uXXXX escape JSON.parse decodes back to it, so no
// spelling slips past; a false positive only costs the guarded parse.
const suspectKeyRx =
	/"(?:(?:_|\\u005[Ff]){2}(?:p|\\u0070)(?:r|\\u0072)(?:o|\\u006[Ff])(?:t|\\u0074)(?:o|\\u006[Ff])(?:_|\\u005[Ff]){2}|(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072))"\s*:/;

export const jsonParseProtectProto = (text, reviver, packageName) => {
	if (!suspectKeyRx.test(text)) {
		return JSON.parse(text, reviver);
	}
	// `function`, not an arrow: the user reviver needs the `this` the fast path
	// above binds.
	return JSON.parse(text, function (key, value) {
		if (
			key === "__proto__" ||
			(key === "constructor" && value && Object.hasOwn(value, "prototype"))
		) {
			throw new HttpError(422, {
				cause: {
					package: packageName,
					data: { reason: "Forbidden key in JSON body", key },
				},
			});
		}
		return reviver ? reviver.call(this, key, value) : value;
	});
};

// Cheap structural-JSON heuristic: returns true if `text` starts with `{`
// or `[`, indicating a JSON object/array body. Use as a Content-Type
// guard where:
//   - `{...}` / `[...]`  → `application/json`
//   - everything else    → `text/plain`
// Deliberately excludes leading `"`: a JSON string `"hi"` parses to a JS
// string, which callers consistently treat as `text/plain`. Avoids running
// a full JSON.parse just to inspect the result's type.
export const isJsonStructured = (text) => {
	if (typeof text !== "string") return false;
	const c = text.charCodeAt(0);
	return c === 123 || c === 91; // 123='{' 91='['
};

export const jsonContentTypePattern =
	/^application\/([a-z0-9.+-]+\+)?json(;|$)/i;

// Decode a request body, transparently handling base64-encoded payloads.
// Takes `body` and `isBase64Encoded` directly so callers (which already
// destructure them from `request.event`) don't pay for a second destructure
// inside this helper. Returns `body` unchanged when it's nullish so callers
// can decide whether absence is an error.
export const decodeBody = (body, isBase64Encoded) => {
	if (body == null) return body;
	return isBase64Encoded ? Buffer.from(body, "base64").toString() : body;
};

export const normalizeHttpResponse = (request) => {
	let { response } = request;
	if (typeof response === "undefined") {
		response = {};
	} else if (
		typeof response?.statusCode === "undefined" &&
		typeof response?.body === "undefined" &&
		typeof response?.headers === "undefined"
	) {
		response = { statusCode: 200, body: response };
	}
	response.statusCode ??= 500;
	response.headers ??= {};
	request.response = response;
	return response;
};

// Paths are dot-delimited and relative to the `request`, with `[]` for array
// elements: `event.headers.authorization`, `error.cause.data.body`.
// Nodes are Maps: a segment is caller data, and a Map key can never resolve to
// an inherited member the way `node[segment]` would, so building the tree needs
// no own-property guard. The segments are still filtered, because `omit` reads
// and writes them as real property names on the payload.
export const buildPathTree = (paths) => {
	const tree = new Map();
	// Copy before sorting so the caller-provided array is never mutated. Reverse
	// so a leaf path (`a.b`) overrides a longer one (`a.b.c`) when both are set.
	for (let path of [...paths].sort().reverse()) {
		if (!Array.isArray(path)) path = path.split(".");
		if (
			path.includes("__proto__") ||
			path.includes("constructor") ||
			path.includes("prototype")
		) {
			continue;
		}
		let node = tree;
		for (let i = 0; i < path.length - 1; i++) {
			const segment = path[i];
			let child = node.get(segment);
			if (child === undefined) {
				child = new Map();
				node.set(segment, child);
			}
			node = child;
		}
		node.set(path[path.length - 1], true);
	}
	return tree;
};

// Returns `obj` unchanged when no `pathTree` entry applies (zero allocations
// on the cold subtree); otherwise returns a shallow clone with matched keys
// masked or removed. Only branches present in `pathTree` are walked.
export const omit = (obj, pathTree, mask) => {
	if (!pathTree || typeof obj !== "object" || obj === null) return obj;
	if (Array.isArray(obj)) return omitArray(obj, pathTree.get("[]"), mask);
	// Errors are not plain objects, so without this branch `omitObject` would
	// never run and the configured path would silently leak.
	if (obj instanceof Error)
		return omitObject(errorToObject(obj), pathTree, mask);
	if (isRecord(obj)) return omitObject(obj, pathTree, mask);
	if (isOpaque(obj)) return obj;
	return omitInstance(obj, pathTree, mask);
};

// A class instance (the durable execution context, a request wrapper from a
// framework) is walked through a copy of its own enumerable properties, so a
// prototype getter is never read and the instance itself comes back when
// nothing under it matched. What the logger gets for it is that plain copy.
const omitInstance = (obj, pathTree, mask) => {
	const copy = { ...obj };
	const next = omitObject(copy, pathTree, mask);
	return next === copy ? obj : next;
};

// Built-ins stay leaves: their own properties are not data to redact (a
// Buffer's indices, a RegExp's lastIndex, a stream's internal state) and a
// spread copy would strip the state that makes them what they are.
const isOpaque = (value) => {
	if (
		value instanceof Date ||
		value instanceof RegExp ||
		value instanceof Map ||
		value instanceof Set ||
		value instanceof WeakMap ||
		value instanceof WeakSet ||
		value instanceof ArrayBuffer ||
		ArrayBuffer.isView(value) ||
		value instanceof ReadableStream ||
		value instanceof WritableStream
	) {
		return true;
	}
	// The remaining probes read properties. A Proxy with a strict `get` trap (a
	// framework's request wrapper) throws for one it does not carry; it is not
	// data to walk either, so it stays a leaf.
	try {
		return (
			typeof value.then === "function" ||
			value._readableState !== undefined ||
			value._writableState !== undefined
		);
	} catch {
		return true;
	}
};

// `cause`, `stack` and `AggregateError.errors` are own but non-enumerable, so a
// spread drops them, and `cause.data` is where middy puts the payload that
// triggered the error. `name` is usually inherited, hence the seed.
const errorToObject = (error) => {
	const out = { name: error.name };
	for (const key of Object.getOwnPropertyNames(error)) {
		out[key] = error[key];
	}
	return out;
};

// A falsy `childTree` needs no guard: every `omit` below then returns its
// element unchanged, so the same array reference comes back.
// Counting down: `.entries()` allocates a tuple per element, and a forward
// `i < l` bound widened to `i <= l` is unobservable. `while (i--)` carries no
// bound arithmetic to widen either, so every mutation of it is observable.
const omitArray = (arr, childTree, mask) => {
	let clone = arr;
	let i = arr.length;
	while (i--) {
		const next = omit(arr[i], childTree, mask);
		if (next !== arr[i]) {
			if (clone === arr) clone = arr.slice();
			clone[i] = next;
		}
	}
	return clone;
};

const omitObject = (obj, pathTree, mask) => {
	let clone = obj;
	let dropped = false;
	for (const [key, sub] of pathTree) {
		if (sub === true) {
			if (!Object.hasOwn(obj, key)) continue;
			if (mask === undefined) {
				dropped = true;
				continue;
			}
			if (clone === obj) clone = { ...obj };
			clone[key] = mask;
			continue;
		}
		const next = omit(obj[key], sub, mask);
		if (next !== obj[key]) {
			if (clone === obj) clone = { ...obj };
			clone[key] = next;
		}
	}
	if (!dropped) return clone;
	// Copying the survivors, not spread-then-delete: `delete` drops the object
	// into dictionary mode, making the logger's later reads ~28x slower.
	// `pathTree.get(key) === true` already identifies every dropped leaf, so no
	// list of them is accumulated and the check stays a lookup, not a scan.
	const survivors = {};
	for (const key in clone) {
		if (pathTree.get(key) !== true) survivors[key] = clone[key];
	}
	return survivors;
};

// Stricter than the schema validator's `isPlainObject`: only a plain object
// is walked in place. Null-prototype maps (built by httpHeaderNormalizer and
// event-normalizer) do count, or the keys they hold would leak into the logs
// unredacted.
// Decided by prototype rather than `value.constructor`: jsonParseProtectProto
// lets a string `constructor` key through, and reading it would mark a plain
// body as non-plain and leave everything under it unredacted.
// `omit` has already ruled out primitives and `null`, on which
// `Object.getPrototypeOf` throws or returns a wrapper prototype.
const isRecord = (value) => {
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
};

// import { STATUS_CODES } from "node:http"; // cost ~14ms
const STATUS_CODES = {
	100: "Continue",
	101: "Switching Protocols",
	102: "Processing",
	103: "Early Hints",
	200: "OK",
	201: "Created",
	202: "Accepted",
	203: "Non-Authoritative Information",
	204: "No Content",
	205: "Reset Content",
	206: "Partial Content",
	207: "Multi-Status",
	208: "Already Reported",
	226: "IM Used",
	300: "Multiple Choices",
	301: "Moved Permanently",
	302: "Found",
	303: "See Other",
	304: "Not Modified",
	305: "Use Proxy",
	307: "Temporary Redirect",
	308: "Permanent Redirect",
	400: "Bad Request",
	401: "Unauthorized",
	402: "Payment Required",
	403: "Forbidden",
	404: "Not Found",
	405: "Method Not Allowed",
	406: "Not Acceptable",
	407: "Proxy Authentication Required",
	408: "Request Timeout",
	409: "Conflict",
	410: "Gone",
	411: "Length Required",
	412: "Precondition Failed",
	413: "Payload Too Large",
	414: "URI Too Long",
	415: "Unsupported Media Type",
	416: "Range Not Satisfiable",
	417: "Expectation Failed",
	418: "I'm a Teapot",
	421: "Misdirected Request",
	422: "Unprocessable Entity",
	423: "Locked",
	424: "Failed Dependency",
	425: "Too Early",
	426: "Upgrade Required",
	428: "Precondition Required",
	429: "Too Many Requests",
	431: "Request Header Fields Too Large",
	451: "Unavailable For Legal Reasons",
	500: "Internal Server Error",
	501: "Not Implemented",
	502: "Bad Gateway",
	503: "Service Unavailable",
	504: "Gateway Timeout",
	505: "HTTP Version Not Supported",
	506: "Variant Also Negotiates",
	507: "Insufficient Storage",
	508: "Loop Detected",
	509: "Bandwidth Limit Exceeded",
	510: "Not Extended",
	511: "Network Authentication Required",
};

const httpErrorNameRegexp = /[^a-zA-Z]/g;
export class HttpError extends Error {
	// The message is always the registered reason phrase for `code`. Anything
	// specific to the failure belongs in `cause.data`, which stays server-side;
	// http-error-handler only ever echoes the message to the client.
	constructor(code, options = {}) {
		super(STATUS_CODES[code], options);

		const name = (STATUS_CODES[code] ?? "Unknown").replace(
			httpErrorNameRegexp,
			"",
		);
		this.name = !name.endsWith("Error") ? `${name}Error` : name;

		this.status = this.statusCode = code; // setting `status` for backwards compatibility w/ `http-errors`
		this.expose = options.expose ?? code < 500;
	}
}
