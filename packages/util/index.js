// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

// Option validation helper.
// Schema values:
//   'string' | 'number' | 'integer' | 'boolean' | 'function' | 'object' | 'array'
//     Trailing '?' marks the field as optional (may be undefined).
//   (value) => boolean predicate — only called when value is not undefined
//     (i.e. predicates treat the field as optional by design).
//   { type: 'array' | 'array?', items: <itemSchema> }
//     `items` is applied to each array element. It can be a type string,
//     a predicate function, or a plain object treated as a per-element
//     object schema (validated recursively with the same rules).
//   { type: '<type>' | '<type>?', minimum?, maximum?, minLength?, maxLength?, pattern? }
//     Numeric: `minimum`/`maximum` (number/integer).
//     String: `minLength`/`maxLength` (string length), `pattern` (regex source).
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
	if (!checker) fail(`Unknown schema type '${type}' for option '${path}'`);
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

// Stable JSON form: recursively sorts object keys, skips function-typed
// values. Used for `uniqueItems` so items that differ only by handler
// identity or key ordering collide.
const stableStringify = (value) => {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`;
	}
	const keys = Object.keys(value)
		.filter((k) => typeof value[k] !== "function")
		.sort();
	return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
};

const resolveInstance = (name) => {
	const ctor = globalThis[name];
	if (typeof ctor !== "function") {
		throw new Error(`Unknown 'instanceof' class '${name}'`);
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
			} catch {}
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
			pattern,
			minLength,
			maxLength,
		} = rule;
		if (!checkTypeSpec(rawType, value, path, fail)) return;
		const type = rawType.endsWith("?") ? rawType.slice(0, -1) : rawType;
		if (minimum !== undefined && value < minimum) {
			fail(`Option '${path}' must be >= ${minimum}`);
		}
		if (maximum !== undefined && value > maximum) {
			fail(`Option '${path}' must be <= ${maximum}`);
		}
		if (pattern !== undefined && !new RegExp(pattern).test(value)) {
			fail(`Option '${path}' must match pattern ${pattern}`);
		}
		if (minLength !== undefined && value.length < minLength) {
			fail(`Option '${path}' must have length >= ${minLength}`);
		}
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
	fail(`Invalid schema for option '${path}'`);
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
	if (isJsonSchemaForm(schema)) {
		checkRule(schema, options, "", fail);
	} else {
		checkSchemaObject(schema, options, "", fail);
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
				cause: { package: "@middy/util" },
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
	return !options.awsClientAssumeRole && !options.disablePrefetch;
};

const safeGet = (obj, key) =>
	obj != null && Object.hasOwn(obj, key) ? obj[key] : undefined;

// Internal Context
export const getInternal = async (variables, request) => {
	if (!variables || !request) return Object.create(null);
	let keys = [];
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
	// (warm/cached invocations), skip all Promise machinery entirely
	let allSync = true;
	const syncResults = new Array(values.length);
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
		}
		syncResults[i] = value;
	}
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
			cause: { package: "@middy/util", data: errors },
		});
	}
	return obj;
};

const isPromise = (promise) => typeof promise?.then === "function";

const sanitizeKeyPrefixLeadingNumber = /^([0-9])/;
const sanitizeKeyRemoveDisallowedChar = /[^a-zA-Z0-9]+/g;
export const sanitizeKey = (key) => {
	return key
		.replace(sanitizeKeyPrefixLeadingNumber, "_$1")
		.replace(sanitizeKeyRemoveDisallowedChar, "_");
};

// fetch Cache
// Map keyed by cacheKey; value shape: { value:{fetchKey:Promise}, expiry, refresh?, modified? }
// Map chosen over plain object so deletion is O(1), frees the key slot, and
// avoids the `delete` operator (biome's performance/noDelete rule).
const cache = new Map();
const defaultCacheMaxSize = 128;

const validateCacheExpiry = (cacheExpiry) => {
	if (
		typeof cacheExpiry === "number" &&
		cacheExpiry < -1 &&
		!Number.isNaN(cacheExpiry)
	) {
		throw new Error(
			`Invalid cacheExpiry value: ${cacheExpiry}. Must be -1 (infinite), 0 (disabled), or a positive number (ms duration or unix timestamp)`,
			{ cause: { package: "@middy/util" } },
		);
	}
};

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
		const unexpired = cached.expiry && (cacheExpiry < 0 || cached.expiry > now);

		if (unexpired) {
			if (cached.modified) {
				const value = middlewareFetch(middlewareFetchRequest, cached.value);
				Object.assign(cached.value, value);
				const entry = { value: cached.value, expiry: cached.expiry };
				cache.set(cacheKey, entry);
				return entry;
			}
			cached.cache = true;
			return cached;
		}
	}
	const value = middlewareFetch(middlewareFetchRequest);
	// cacheExpiry semantics:
	//   >86400000 (24h): treated as unix timestamp (ms)
	//   >0 && <=86400000: treated as duration (ms) from now
	//   -1: infinite cache (never expires)
	//   0/undefined/null: no caching
	const expiry = cacheExpiry > 86400000 ? cacheExpiry : now + cacheExpiry;
	const duration = cacheExpiry > 86400000 ? cacheExpiry - now : cacheExpiry;
	if (cacheExpiry) {
		clearTimeout(cache.get(cacheKey)?.refresh);
		// .unref() so a pending refresh timer does not keep the Lambda event
		// loop alive (relevant under `callbackWaitsForEmptyEventLoop: false`).
		const refresh =
			duration > 0
				? setTimeout(
						() =>
							processCache(options, middlewareFetch, middlewareFetchRequest),
						duration,
					).unref()
				: undefined;
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
	let oldestExpiry = Infinity;
	for (const [key, entry] of cache) {
		if (entry && entry.expiry < oldestExpiry) {
			oldestExpiry = entry.expiry;
			oldestKey = key;
		}
	}
	if (oldestKey !== null) {
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

export const isExecutionModeDurable = (context) => {
	// using `context instanceof DurableContextImpl` would be better
	// but would require an extra dependency
	return context.constructor.name === "DurableContextImpl";
};

export const executionContext = (request, key, context) => {
	if (isExecutionModeDurable(context)) {
		return request.context.executionContext[key];
	}
	return request.context[key];
};

export const lambdaContext = (request, key, context) => {
	if (isExecutionModeDurable(context)) {
		return request.context.lambdaContext[key];
	}
	return request.context[key];
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

export const jsonSafeStringify = (value, replacer, space) => {
	try {
		return JSON.stringify(value, replacer, space);
	} catch {
		return value;
	}
};

export const jsonContentTypePattern =
	/^application\/([a-z0-9.+-]+\+)?json(;|$)/i;

export const decodeBody = (event) => {
	const { body, isBase64Encoded } = event;
	if (typeof body === "undefined" || body === null) return body;
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
		message ??= httpErrorCodes[code];
		super(message, options);

		const name = (httpErrorCodes[code] ?? "Unknown").replace(
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

export const httpErrorCodes = {
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
	306: "(Unused)",
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
	418: "I'm a teapot",
	421: "Misdirected Request",
	422: "Unprocessable Entity",
	423: "Locked",
	424: "Failed Dependency",
	425: "Unordered Collection",
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
