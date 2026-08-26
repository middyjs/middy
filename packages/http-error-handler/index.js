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
	// Stryker disable next-line ArrayDeclaration: equivalent. A non-empty default keys the tree by its first path segment (e.g. "Stryker"), never a request key, so nothing on the request is ever matched, same as [].
	omitPaths: [],
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

const httpErrorHandlerMiddleware = (opts = {}) => {
	const { logger, fallbackMessage, omitPaths, mask } = { ...defaults, ...opts };

	const omitPathTree = buildPathTree(omitPaths);

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
		if (!error.expose || !error.statusCode) {
			request.error = {
				statusCode: 500,
				message: fallbackMessage,
				expose: true,
			};
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
