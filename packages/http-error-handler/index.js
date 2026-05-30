// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	isJsonStructured,
	normalizeHttpResponse,
	validateOptions,
} from "@middy/util";

const name = "http-error-handler";
const pkg = `@middy/${name}`;

const defaults = {
	logger: console.error,
	fallbackMessage: undefined,
};

const optionSchema = {
	type: "object",
	properties: {
		logger: { oneOf: [{ instanceof: "Function" }, { const: false }] },
		fallbackMessage: { type: "string" },
	},
	additionalProperties: false,
};

export const httpErrorHandlerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const httpErrorHandlerMiddleware = (opts = {}) => {
	const { logger, fallbackMessage } = { ...defaults, ...opts };

	const httpErrorHandlerMiddlewareOnError = (request) => {
		if (typeof request.response !== "undefined") return;
		if (typeof logger === "function") {
			logger(request.error);
		}

		const error =
			typeof request.error === "object" ? (request.error ?? {}) : {};

		// Set default expose value, only passes in when there is an override
		if (error.statusCode && typeof error.expose === "undefined") {
			error.expose = error.statusCode < 500;
		}

		// Non-http error OR expose set to false
		// biome-ignore format: keep the inline Stryker directive attached to the else block's leading comment
		if (!error.expose || !error.statusCode) {
			request.error = {
				statusCode: 500,
				message: fallbackMessage,
				expose: true,
			};
		} else /* Stryker disable next-line BlockStatement: equivalent mutant - this else branch only runs when the local `error` came from `request.error ?? {}` with a truthy statusCode, so `error === request.error` and the assignment is a self-assignment with no observable effect. */ {
			request.error = error;
		}

		// Stryker disable next-line ConditionalExpression: equivalent mutant - after the block above `request.error.expose` is always truthy (the fallback sets `expose: true`; the else branch keeps an error whose `expose` was already truthy), so forcing the guard to `true` cannot be observed.
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

			// Stryker disable next-line ConditionalExpression: equivalent mutant - forcing the guard to `true` runs `Object.assign(target, undefined)` when `headers` is undefined, which is a spec no-op, so the guard has no observable effect.
			if (headers) {
				Object.assign(request.response.headers, headers);
			}
		}
	};

	return {
		onError: httpErrorHandlerMiddlewareOnError,
	};
};
export default httpErrorHandlerMiddleware;
