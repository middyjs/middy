// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { buildPathTree, omit, validateOptions } from "@middy/util";

const name = "event-logger";
const pkg = `@middy/${name}`;

const defaults = {
	logger: ({ event }) => {
		console.log(JSON.stringify({ event }));
	},
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

export const eventLoggerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const eventLoggerMiddleware = (opts = {}) => {
	const { logger, omitPaths, mask } = { ...defaults, ...opts };

	if (typeof logger !== "function") return {};

	const omitPathTree = omitPaths && buildPathTree(omitPaths);

	const eventLoggerMiddlewareBefore = (request) =>
		logger(omit(request, omitPathTree, mask));

	return {
		before: eventLoggerMiddlewareBefore,
	};
};

export default eventLoggerMiddleware;
