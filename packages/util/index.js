// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { STATUS_CODES } from "node:http";

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
	let result;
	if (Array.isArray(value)) {
		result = `[${value.map((v) => stableStringify(v, seen)).join(",")}]`;
	} else {
		const keys = Object.keys(value)
			.filter((k) => typeof value[k] !== "function")
			.sort();
		// Stryker disable next-line StringLiteral: removing the key/value join "," is equivalent; JSON.stringify quotes every key, so no two distinct objects can ever serialize to the same string with or without the separator (and equal objects stay equal).
		result = `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k], seen)}`).join(",")}}`;
	}
	seen.delete(value);
	return result;
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
		// Stryker disable next-line ConditionalExpression: dropping the `minimum !== undefined` guard is equivalent; when minimum is undefined, `value < undefined` is always false.
		if (minimum !== undefined && value < minimum) {
			fail(`Option '${path}' must be >= ${minimum}`);
		}
		// Stryker disable next-line ConditionalExpression: dropping the `maximum !== undefined` guard is equivalent; `value > undefined` is always false.
		if (maximum !== undefined && value > maximum) {
			fail(`Option '${path}' must be <= ${maximum}`);
		}
		// Stryker disable next-line ConditionalExpression: dropping the `exclusiveMinimum !== undefined` guard is equivalent; `value <= undefined` is always false.
		if (exclusiveMinimum !== undefined && value <= exclusiveMinimum) {
			fail(`Option '${path}' must be > ${exclusiveMinimum}`);
		}
		const hasStringConstraint =
			pattern !== undefined ||
			minLength !== undefined ||
			maxLength !== undefined;
		if (hasStringConstraint && typeof value !== "string") {
			fail(`Option '${path}' must be string`);
		}
		if (pattern !== undefined && value.match(pattern) === null) {
			fail(`Option '${path}' must match pattern ${pattern}`);
		}
		// Stryker disable next-line ConditionalExpression: dropping the `minLength !== undefined` guard is equivalent; `value.length < undefined` is always false.
		if (minLength !== undefined && value.length < minLength) {
			fail(`Option '${path}' must have length >= ${minLength}`);
		}
		// Stryker disable next-line ConditionalExpression: dropping the `maxLength !== undefined` guard is equivalent; `value.length > undefined` is always false.
		if (maxLength !== undefined && value.length > maxLength) {
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
		// carry that shape and pass through untouched.
		// Stryker disable next-line ConditionalExpression: forcing this true is equivalent; the only non-SchemaError reaching here is a `fail()` TypeError that already carries cause.package, so re-wrapping it via `fail(e.message)` produces an identical message + cause.
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
		if (!request) {
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

export const canPrefetch = (options = {}) => {
	return (
		!options.awsClientAssumeRole &&
		!options.disablePrefetch &&
		options.cacheExpiry !== 0
	);
};

const safeGet = (obj, key) =>
	obj != null && Object.hasOwn(obj, key) ? obj[key] : undefined;

// Internal Context
export const getInternal = async (variables, request) => {
	if (!variables || !request?.internal) return Object.create(null);
	let keys = [];
	// Stryker disable next-line ArrayDeclaration: equivalent; this initial value is only observable when no branch below matches (variables is a truthy non-true/string/array/object), and in that case `keys` stays [] so the output is always {} regardless of `values`.
	let values = [];
	if (variables === true) {
		keys = values = Object.keys(request.internal);
	} else if (typeof variables === "string") {
		keys = values = [variables];
	} else if (Array.isArray(variables)) {
		keys = values = variables;
	} else if (typeof variables === "object") {
		keys = Object.keys(variables);
		values = Object.values(variables);
	}
	// Fast synchronous path: when all internal values are already resolved
	// (warm/cached invocations), skip all Promise machinery entirely.
	// The async fallback below produces byte-for-byte identical output, so the
	// following sync-path mutants are equivalent: they only ever route execution
	// to the async path (or vice versa), never change the resolved result.
	// Stryker disable next-line BooleanLiteral: equivalent; starting allSync=false just forces the async path, which yields the same result.
	let allSync = true;
	// Stryker disable next-line ArrayDeclaration: equivalent; new Array() vs new Array(n) both accept the same indexed assignments.
	const syncResults = new Array(values.length);
	for (let i = 0; i < values.length; i++) {
		const internalKey = values[i];
		const dotIndex = internalKey.indexOf(".");
		const rootKey =
			dotIndex === -1 ? internalKey : internalKey.substring(0, dotIndex);
		let value = request.internal[rootKey];
		// Stryker disable next-line ConditionalExpression: equivalent; forcing the async path for every value yields the same result.
		if (isPromise(value)) {
			allSync = false;
			break;
		}
		if (dotIndex !== -1) {
			for (const part of internalKey.substring(dotIndex + 1).split(".")) {
				value = safeGet(value, part);
			}
		}
		syncResults[i] = value;
	}
	// Stryker disable next-line ConditionalExpression,BlockStatement: equivalent; skipping the sync fast-path defers to the async fallback, which returns the same object.
	if (allSync) {
		const obj = Object.create(null);
		for (let i = 0; i < keys.length; i++) {
			obj[sanitizeKey(keys[i])] = syncResults[i];
		}
		return obj;
	}

	// Async fallback: for cold/first invocations with pending promises
	const promises = [];
	for (const internalKey of values) {
		// 'internal.key.sub_value' -> { [key]: internal.key.sub_value }
		const pathOptionKey = internalKey.split(".");
		const rootOptionKey = pathOptionKey.shift();
		let valuePromise = request.internal[rootOptionKey];
		// Stryker disable next-line ConditionalExpression: equivalent; Promise.resolve(p) returns p unchanged when p is already a promise, so always wrapping yields the same value.
		if (!isPromise(valuePromise)) {
			valuePromise = Promise.resolve(valuePromise);
		}
		promises.push(
			valuePromise.then((value) => pathOptionKey.reduce(safeGet, value)),
		);
	}
	// ensure promise has resolved by the time it's needed
	// If one of the promises throws it will bubble up to @middy/core
	values = await Promise.allSettled(promises);
	const obj = Object.create(null);
	let errors;
	for (let i = 0; i < keys.length; i++) {
		if (values[i].status === "rejected") {
			errors ??= [];
			errors.push(values[i].reason);
		} else {
			obj[sanitizeKey(keys[i])] = values[i].value;
		}
	}
	if (errors) {
		throw new Error("Failed to resolve internal values", {
			cause: { package: pkg, data: errors },
		});
	}
	return obj;
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
		// Stryker disable next-line ConditionalExpression,EqualityOperator: the always-cache and cap-boundary variants are equivalent - storing past (or one entry beyond) the cap only changes whether a deterministic value is later recomputed, never the returned value, and killing them would require a test coupled to the exact global fill state of the memo. (The never-cache variants are killed by the replace-spy memo test.)
		if (sanitizeKeyCache.size < sanitizeKeyCacheMaxSize) {
			sanitizeKeyCache.set(key, sanitized);
		}
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
// returns either `null` (when `setToContext` is false) or the precomputed
// `[[originalKey, sanitizedKey], …]` pairs.
//
// `assignSetToContext(spec, value, request)` is called once per invocation.
// Returns `undefined` synchronously when all entries are resolved (the
// common warm path), or a Promise when at least one is still pending. The
// caller should `if (p) await p` so the sync path keeps zero microtask hops.
export const buildSetToContextSpec = (options) =>
	options.setToContext
		? Object.keys(options.fetchData).map((k) => [k, sanitizeKey(k)])
		: null;

export const assignSetToContext = (spec, value, request) => {
	for (let i = 0; i < spec.length; i++) {
		const v = value[spec[i][0]];
		// Stryker disable next-line ConditionalExpression: the `v !== null` operand is equivalent (redundant). The `typeof v?.then` optional chain already null-guards: `null?.then` is undefined, so `typeof undefined === "function"` is false whether or not the explicit null check is present.
		if (v !== null && typeof v?.then === "function") {
			// Cold path: at least one value still pending; defer to
			// `getInternal` for the standard await+sanitize+assign flow.
			// Stryker disable next-line ArrayDeclaration: equivalent; new Array() vs new Array(n) both accept the same indexed assignments.
			const keys = new Array(spec.length);
			for (let j = 0; j < spec.length; j++) keys[j] = spec[j][0];
			return getInternal(keys, request).then((data) => {
				Object.assign(request.context, data);
			});
		}
	}
	const ctx = request.context;
	for (let i = 0; i < spec.length; i++) {
		ctx[spec[i][1]] = value[spec[i][0]];
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
	if (
		// Stryker disable next-line ConditionalExpression: equivalent; any non-number value also fails `!Number.isInteger(cacheExpiry)` on the next line, so dropping this typeof guard rejects exactly the same inputs.
		typeof cacheExpiry !== "number" ||
		!Number.isInteger(cacheExpiry) ||
		cacheExpiry < -1
	) {
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

// Module-scope so the warm cache-hit path allocates no closure; only the
// scheduling paths (modified entry, miss) create the timer callback.
const scheduleRefresh = (
	duration,
	options,
	middlewareFetch,
	middlewareFetchRequest,
) =>
	duration > 0 && Number.isFinite(duration)
		? setTimeout(
				() => processCache(options, middlewareFetch, middlewareFetchRequest),
				duration,
			).unref()
		: undefined;

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
		const effectiveExpiry =
			cacheExpiry > 86400000 ? cacheExpiry : cached.expiry;
		const unexpired =
			// Stryker disable next-line ConditionalExpression,EqualityOperator: the `cacheExpiry < 0` branch is equivalent. cacheExpiry === 0 is unreachable (guarded by `if (cacheExpiry)`), and for the only negative value -1 the stored expiry is Infinity so `effectiveExpiry > now` is already always true. (-1 -> 0 boundary cannot be observed.)
			cached.expiry && (cacheExpiry < 0 || effectiveExpiry > now);

		if (unexpired) {
			if (cached.modified) {
				const value = middlewareFetch(middlewareFetchRequest, cached.value);
				silenceFetchRejections(value);
				Object.assign(cached.value, value);
				const refresh = scheduleRefresh(
					cached.expiry - now,
					options,
					middlewareFetch,
					middlewareFetchRequest,
				);
				const entry = { value: cached.value, expiry: cached.expiry, refresh };
				cache.set(cacheKey, entry);
				return entry;
			}
			cached.cache = true;
			return cached;
		}
	}
	const value = middlewareFetch(middlewareFetchRequest);
	silenceFetchRejections(value);
	// cacheExpiry semantics:
	//   >86400000 (24h): treated as unix timestamp (ms)
	//   >0 && <=86400000: treated as duration (ms) from now
	//   -1: infinite cache (never expires)
	//   0/undefined/null: no caching
	const expiry =
		cacheExpiry < 0
			? Number.POSITIVE_INFINITY
			: cacheExpiry > 86400000
				? cacheExpiry
				: now + cacheExpiry;
	// Stryker disable next-line EqualityOperator: the `> 86400000` -> `>= 86400000` change is equivalent for the refresh duration. It only differs at cacheExpiry === 86400000, where it shifts the auto-refresh timer by `now` ms; the refresh callback re-validates the (separately-set) expiry, so the same number of fetches occur and no observable difference results.
	const duration = cacheExpiry > 86400000 ? cacheExpiry - now : cacheExpiry;
	if (cacheExpiry) {
		clearTimeout(cache.get(cacheKey)?.refresh);
		const refresh = scheduleRefresh(
			duration,
			options,
			middlewareFetch,
			middlewareFetchRequest,
		);
		cache.set(cacheKey, { value, expiry, refresh });
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

const evictCache = (maxSize) => {
	if (cache.size <= maxSize) return;
	let oldestKey = null;
	let oldestExpiry;
	for (const [key, entry] of cache) {
		if (entry && (oldestKey === null || entry.expiry < oldestExpiry)) {
			oldestExpiry = entry.expiry;
			oldestKey = key;
		}
	}
	// Stryker disable next-line ConditionalExpression: equivalent; evictCache only runs when cache.size > maxSize (>0) and every cache entry is a truthy object, so the loop always sets oldestKey to a real key. Forcing this guard true would at worst delete the null key, a harmless no-op.
	if (oldestKey !== null) {
		// Stryker disable next-line OptionalChaining: equivalent; oldestKey was just read from the live cache in the loop above, so cache.get(oldestKey) is always defined and the optional chain never short-circuits.
		clearTimeout(cache.get(oldestKey)?.refresh);
		cache.delete(oldestKey);
	}
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
	"callbackWaitsForEmptyEventLoop",
];

export const executionContextKeys = ["tenantId"];

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

export const jsonParseProtectProto = (text, reviver, packageName) => {
	return JSON.parse(text, (key, value) => {
		if (
			key === "__proto__" ||
			(key === "constructor" && value && Object.hasOwn(value, "prototype"))
		) {
			throw createError(422, "Forbidden key in JSON body", {
				cause: { package: packageName, data: key },
			});
		}
		return reviver ? reviver(key, value) : value;
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

const createErrorRegexp = /[^a-zA-Z]/g;
export class HttpError extends Error {
	constructor(code, optionalMessage, optionalOptions = {}) {
		let message = optionalMessage;
		let options = optionalOptions;
		if (message && typeof message !== "string") {
			options = message;
			message = undefined;
		}
		message ??= STATUS_CODES[code];
		super(message, options);

		const name = (STATUS_CODES[code] ?? "Unknown").replace(
			createErrorRegexp,
			"",
		);
		this.name = !name.endsWith("Error") ? `${name}Error` : name;

		this.status = this.statusCode = code; // setting `status` for backwards compatibility w/ `http-errors`
		this.expose = options.expose ?? code < 500;
	}
}

export const createError = (code, message, properties = {}) => {
	return new HttpError(code, message, properties);
};
