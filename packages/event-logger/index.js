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
		logger: { instanceof: "Function" },
		omitPaths: { type: "array", items: { type: "string" } },
		mask: { type: "string" },
	},
	additionalProperties: false,
};

export const eventLoggerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const eventLoggerMiddleware = (opts = {}) => {
	// `{ ...defaults, ...opts }` lets an explicit `logger: undefined` override
	// the default; the destructuring default restores it, matching the option
	// validator, which treats an undefined property as absent.
	const {
		logger = defaults.logger,
		omitPaths,
		mask,
	} = { ...defaults, ...opts };

	// Logging is this middleware's only job, so there is no "off" setting: omit
	// the middleware instead. The validator keeps the generic option wording;
	// this names the fix.
	if (typeof logger !== "function") {
		throw new TypeError(
			`Option 'logger' must be a function; ${pkg} only logs, omit the middleware to disable logging`,
			{ cause: { package: pkg } },
		);
	}

	const omitPathTree = omitPaths && buildPathTree(omitPaths);

	// Block body: core treats any defined hook return as an early response, and
	// loggers such as winston return themselves from `logger.info()`.
	const eventLoggerMiddlewareBefore = (request) => {
		logger(omit(request, omitPathTree, mask));
	};

	return {
		before: eventLoggerMiddlewareBefore,
	};
};

export default eventLoggerMiddleware;
