// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	buildPathTree,
	omit,
	omitPathsSchema,
	validateOmitPaths,
	validateOptions,
} from "@middy/util";

const name = "error-logger";
const pkg = `@middy/${name}`;

const defaults = {
	logger: ({ error }) => console.error(error),
	omitPaths: undefined,
	mask: undefined,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:error-logger:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		logger: { $ref: "#/$defs/Function" },
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

export const errorLoggerValidateOptions = (options) => {
	const validated = validateOptions(pkg, optionSchema, options);
	validateOmitPaths(validated.omitPaths);
	return validated;
};

const errorLoggerMiddleware = (opts = {}) => {
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
	// loggers such as winston return themselves from `logger.error()`. A logger
	// that throws is reported, not propagated: logging must not change the
	// invocation outcome (e.g. replace a handled 404 with an AggregateError).
	const errorLoggerMiddlewareOnError = (request) => {
		try {
			const logged = logger(omit(request, omitPathTree, mask));
			if (typeof logged?.then === "function") {
				return settleLoggerPromise(logged);
			}
		} catch (e) {
			console.error(e);
		}
	};
	return {
		onError: errorLoggerMiddlewareOnError,
	};
};

const settleLoggerPromise = async (logged) => {
	try {
		await logged;
	} catch (e) {
		console.error(e);
	}
};

export default errorLoggerMiddleware;
