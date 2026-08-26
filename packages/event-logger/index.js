// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { buildPathTree, omit, validateOptions } from "@middy/util";

const name = "event-logger";
const pkg = `@middy/${name}`;

const defaults = {
	logger: ({ event }) => {
		console.log(JSON.stringify({ event }));
	},
	// Stryker disable next-line ArrayDeclaration: equivalent. A non-empty default keys the tree by its first path segment (e.g. "Stryker"), never a request key, so nothing on the request is ever matched, same as [].
	omitPaths: [],
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

	const omitPathTree = buildPathTree(omitPaths);

	const eventLoggerMiddlewareBefore = (request) =>
		logger(omit(request, omitPathTree, mask));

	return {
		before: eventLoggerMiddlewareBefore,
	};
};

export default eventLoggerMiddleware;
