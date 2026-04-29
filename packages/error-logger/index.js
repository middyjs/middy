// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { validateOptions } from "@middy/util";

const name = "error-logger";
const pkg = `@middy/${name}`;

const defaults = {
	logger: ({ error }) => console.error(error),
};

const optionSchema = {
	type: "object",
	properties: {
		logger: { oneOf: [{ instanceof: "Function" }, { const: false }] },
	},
	additionalProperties: false,
};

export const errorLoggerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const errorLoggerMiddleware = (opts = {}) => {
	const { logger } = { ...defaults, ...opts };

	const errorLoggerMiddlewareOnError = (request) => {
		logger(request);
	};
	return {
		onError:
			typeof logger === "function" ? errorLoggerMiddlewareOnError : undefined,
	};
};
export default errorLoggerMiddleware;
