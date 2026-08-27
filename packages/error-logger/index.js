// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { buildPathTree, omit, validateOptions } from "@middy/util";

const name = "error-logger";
const pkg = `@middy/${name}`;

const defaults = {
	logger: ({ error }) => console.error(error),
	omitPaths: undefined,
	mask: undefined,
};

const optionSchema = {
	type: "object",
	properties: {
		logger: { oneOf: [{ instanceof: "Function" }, { const: false }] },
		omitPaths: { type: "array", items: { type: "string" } },
		mask: { type: "string" },
	},
	additionalProperties: false,
};

export const errorLoggerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const errorLoggerMiddleware = (opts = {}) => {
	const { logger, omitPaths, mask } = { ...defaults, ...opts };

	const omitPathTree = omitPaths && buildPathTree(omitPaths);

	const errorLoggerMiddlewareOnError = (request) => {
		logger(omit(request, omitPathTree, mask));
	};
	return {
		onError:
			typeof logger === "function" ? errorLoggerMiddlewareOnError : undefined,
	};
};
export default errorLoggerMiddleware;
