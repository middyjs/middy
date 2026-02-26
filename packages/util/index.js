// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
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

// Internal Context
export const getInternal = async (variables, request) => {
	if (!variables || !request) return {};
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
				value = value?.[part];
			}
		}
		syncResults[i] = value;
	}
	if (allSync) {
		const obj = {};
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
			valuePromise.then((value) =>
				pathOptionKey.reduce((p, c) => p?.[c], value),
			),
		);
	}
	// ensure promise has resolved by the time it's needed
	// If one of the promises throws it will bubble up to @middy/core
	values = await Promise.allSettled(promises);
	const obj = {};
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
const cache = Object.create(null); // key: { value:{fetchKey:Promise}, expiry }
export const processCache = (
	options,
	middlewareFetch = () => undefined,
	middlewareFetchRequest = {},
) => {
	let { cacheKey, cacheKeyExpiry, cacheExpiry } = options;
	cacheExpiry = cacheKeyExpiry?.[cacheKey] ?? cacheExpiry;
	const now = Date.now();
	if (cacheExpiry) {
		const cached = getCache(cacheKey);
		const unexpired = cached.expiry && (cacheExpiry < 0 || cached.expiry > now);

		if (unexpired) {
			if (cached.modified) {
				const value = middlewareFetch(middlewareFetchRequest, cached.value);
				Object.assign(cached.value, value);
				cache[cacheKey] = { value: cached.value, expiry: cached.expiry };
				return cache[cacheKey];
			}
			cached.cache = true;
			return cached;
		}
	}
	const value = middlewareFetch(middlewareFetchRequest);
	// secrets-manager can override to unix timestamp
	const expiry = cacheExpiry > 86400000 ? cacheExpiry : now + cacheExpiry;
	const duration = cacheExpiry > 86400000 ? cacheExpiry - now : cacheExpiry;
	if (cacheExpiry) {
		const refresh =
			duration > 0
				? setTimeout(
						() =>
							processCache(options, middlewareFetch, middlewareFetchRequest),
						duration,
					)
				: undefined;
		cache[cacheKey] = { value, expiry, refresh };
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
	if (!cache[key]) return {};
	return cache[key];
};

// Used to remove parts of a cache
export const modifyCache = (cacheKey, value) => {
	if (!cache[cacheKey]) return;
	clearTimeout(cache[cacheKey].refresh);
	cache[cacheKey].value = value;
	cache[cacheKey].modified = true;
};

export const clearCache = (inputKeys = null) => {
	let keys = inputKeys;
	keys ??= Object.keys(cache);
	if (!Array.isArray(keys)) {
		keys = [keys];
	}
	for (const cacheKey of keys) {
		clearTimeout(cache[cacheKey]?.refresh);
		cache[cacheKey] = undefined;
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

		const name = httpErrorCodes[code].replace(createErrorRegexp, "");
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
