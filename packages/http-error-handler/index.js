// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	jsonSafeParse,
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

		// Set default expose value, only passes in when there is an override
		if (
			request.error.statusCode &&
			typeof request.error.expose === "undefined"
		) {
			request.error.expose = request.error.statusCode < 500;
		}

		// Non-http error OR expose set to false
		if (!request.error.expose || !request.error.statusCode) {
			request.error = {
				statusCode: 500,
				message: fallbackMessage,
				expose: true,
			};
		}

		if (request.error.expose) {
			normalizeHttpResponse(request);
			const { statusCode, message, headers } = request.error;

			request.response.statusCode = statusCode;
			if (headers) {
				Object.assign(request.response.headers, headers);
			}

			if (message) {
				const headerContentType =
					typeof jsonSafeParse(message) === "string"
						? "text/plain"
						: "application/json";
				request.response.body = message;
				request.response.headers["Content-Type"] = headerContentType;
			}
		}
	};

	return {
		onError: httpErrorHandlerMiddlewareOnError,
	};
};
export default httpErrorHandlerMiddleware;
