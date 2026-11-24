// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	buildPathTree,
	isJsonStructured,
	normalizeHttpResponse,
	omit,
	omitPathsSchema,
	validateOmitPaths,
	validateOptions,
} from "@middy/util";

const name = "http-error-handler";
const pkg = `@middy/${name}`;

const defaults = {
	logger: (request) => console.error(request.error),
	fallbackMessage: undefined,
	omitPaths: undefined,
	mask: undefined,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:http-error-handler:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		logger: {
			oneOf: [{ $ref: "#/$defs/Function" }, { type: "boolean", const: false }],
		},
		fallbackMessage: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\p{L}\p{M}\p{N}\p{P}\p{S} \t\n\r]*$/u,
		},
		omitPaths: omitPathsSchema,
		mask: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\p{L}\p{N}\p{P}\p{S} ]*$/u,
		},
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const httpErrorHandlerValidateOptions = (options) => {
	const validated = validateOptions(pkg, optionSchema, options);
	validateOmitPaths(validated.omitPaths);
	return validated;
};

// An Error `cause` keeps its `name`, its `message` and, when it has one, its
// own `cause`, all the way down; the stack stays out. Anything that is not an
// Error (a thrown string, `null`, a plain object) is handed to JSON.stringify
// as it is. A chain that loops back on itself stops at the repeat.
const serializeCause = (value, seen = new Set()) => {
	if (
		value === null ||
		typeof value !== "object" ||
		typeof value.message !== "string"
	) {
		return value;
	}
	if (seen.has(value)) return "[Circular]";
	seen.add(value);
	const json = { name: value.name, message: value.message };
	if (value.cause !== undefined) {
		json.cause = serializeCause(value.cause, seen);
	}
	return json;
};

// The generic 500 that replaces a non-http (or `expose: false`) error. On an
// Error, `message` and `cause` are non-enumerable, so a downstream logger doing
// `JSON.stringify(request.error)` would otherwise see only
// `{ statusCode, expose }`.
class FallbackError extends Error {
	constructor(message, cause) {
		super(message, { cause });
		this.statusCode = 500;
		this.expose = true;
	}

	toJSON() {
		return {
			statusCode: this.statusCode,
			message: this.message,
			expose: this.expose,
			cause: serializeCause(this.cause),
		};
	}
}

const isExposableHttpError = (error) =>
	error.expose === true &&
	Number.isInteger(error.statusCode) &&
	error.statusCode >= 400 &&
	error.statusCode <= 599;

const httpErrorHandlerMiddleware = (opts = {}) => {
	const { logger, fallbackMessage, omitPaths, mask } = { ...defaults, ...opts };

	const omitPathTree = omitPaths && buildPathTree(omitPaths);

	const httpErrorHandlerMiddlewareOnError = (request) => {
		if (typeof request.response !== "undefined") return;
		if (typeof logger === "function") {
			try {
				const logged = logger(omit(request, omitPathTree, mask));
				if (typeof logged?.then === "function") {
					return setErrorResponseAfterLogger(logged, request);
				}
			} catch (e) {
				console.error(e);
			}
		}
		setErrorResponse(request);
	};

	const setErrorResponseAfterLogger = async (logged, request) => {
		try {
			await logged;
		} catch (e) {
			console.error(e);
		}
		setErrorResponse(request);
	};

	const setErrorResponse = (request) => {
		const error =
			typeof request.error === "object" ? (request.error ?? {}) : {};

		// The original stays reachable as `cause` for onError middleware that run
		// after this one (those registered before it).
		if (!isExposableHttpError(error)) {
			request.error = new FallbackError(fallbackMessage, request.error);
		}

		// Either way `request.error` is now an exposable http error.
		normalizeHttpResponse(request);
		const { statusCode, message, headers } = request.error;

		request.response.statusCode = statusCode;

		if (message) {
			request.response.body = message;
			request.response.headers["Content-Type"] = isJsonStructured(message)
				? "application/json"
				: "text/plain";
		}

		Object.assign(request.response.headers, headers);

		if (isAlbMultiValue(request.event)) {
			moveToMultiValueHeaders(request.response);
		}
	};

	return {
		onError: httpErrorHandlerMiddlewareOnError,
	};
};

// An ALB target group with multi-value headers enabled sends
// `multiValueHeaders` and only reads them back: "You must use
// multiValueHeaders if you have enabled multi-value headers and headers
// otherwise." Its events are the only ones that carry `requestContext.elb`
// together with `multiValueHeaders`.
// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers
const isAlbMultiValue = (event) =>
	typeof event?.requestContext?.elb !== "undefined" &&
	typeof event.multiValueHeaders !== "undefined";

// The response is built here from nothing, so every header moves over.
const moveToMultiValueHeaders = (response) => {
	const multiValueHeaders = {};
	for (const key of Object.keys(response.headers)) {
		const value = response.headers[key];
		multiValueHeaders[key] = Array.isArray(value) ? value : [value];
	}
	response.headers = {};
	response.multiValueHeaders = multiValueHeaders;
};

export default httpErrorHandlerMiddleware;
