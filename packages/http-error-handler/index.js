// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	buildPathTree,
	isJsonStructured,
	normalizeHttpResponse,
	omit,
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
	type: "object",
	properties: {
		logger: { oneOf: [{ instanceof: "Function" }, { const: false }] },
		fallbackMessage: { type: "string" },
		omitPaths: { type: "array", items: { type: "string" } },
		mask: { type: "string" },
	},
	additionalProperties: false,
};

export const httpErrorHandlerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

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

const httpErrorHandlerMiddleware = (opts = {}) => {
	const { logger, fallbackMessage, omitPaths, mask } = { ...defaults, ...opts };

	const omitPathTree = omitPaths && buildPathTree(omitPaths);

	const httpErrorHandlerMiddlewareOnError = (request) => {
		if (typeof request.response !== "undefined") return;
		if (typeof logger === "function") {
			logger(omit(request, omitPathTree, mask));
		}

		const error =
			typeof request.error === "object" ? (request.error ?? {}) : {};

		// Set default expose value, only passes in when there is an override
		if (error.statusCode && typeof error.expose === "undefined") {
			error.expose = error.statusCode < 500;
		}

		// Replace non-http errors (or errors with expose: false) with a generic
		// fallback. When the guard is false, request.error already holds the http
		// error to expose (error === request.error), so it is left untouched.
		// The original stays reachable as `cause` for onError middleware that run
		// after this one (those registered before it).
		if (!error.expose || !error.statusCode) {
			request.error = new FallbackError(fallbackMessage, request.error);
		}

		// Stryker disable next-line ConditionalExpression: equivalent mutant - after the block above `request.error.expose` is always truthy (the fallback sets `expose: true`; a kept error already had a truthy `expose`), so forcing the guard to `true` cannot be observed.
		if (request.error.expose) {
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
		}
	};

	return {
		onError: httpErrorHandlerMiddlewareOnError,
	};
};
export default httpErrorHandlerMiddleware;
