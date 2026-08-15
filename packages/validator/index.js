// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createError, validateOptions } from "@middy/util";

const name = "validator";
const pkg = `@middy/${name}`;

const defaults = {
	eventSchema: undefined,
	contextSchema: undefined,
	responseSchema: undefined,
	defaultLanguage: "en",
	languages: {},
};

const optionSchema = {
	type: "object",
	properties: {
		eventSchema: { instanceof: "Function" },
		contextSchema: { instanceof: "Function" },
		responseSchema: { instanceof: "Function" },
		defaultLanguage: { type: "string" },
		languages: {
			type: "object",
			additionalProperties: { instanceof: "Function" },
		},
	},
	additionalProperties: false,
};

export const validatorValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const validatorMiddleware = (opts = {}) => {
	const {
		eventSchema,
		contextSchema,
		responseSchema,
		defaultLanguage,
		languages,
	} = { ...defaults, ...opts };

	// AJV `$async` validators return a promise (and throw on invalid) instead of
	// a boolean, so the synchronous validation paths below would silently treat
	// every input as valid. Reject them at setup rather than failing open.
	for (const [label, schema] of [
		["eventSchema", eventSchema],
		["contextSchema", contextSchema],
		["responseSchema", responseSchema],
	]) {
		if (schema?.$async) {
			throw new Error(
				`${pkg} ${label} is an $async AJV validator, which is not supported; compile the schema without $async`,
				{ cause: { package: pkg } },
			);
		}
	}

	const validatorMiddlewareBefore = (request) => {
		if (eventSchema) {
			// AJV-compiled validators are synchronous (unless `$async`);
			// dropping `await` skips a per-hook microtask on the warm path.
			const validEvent = eventSchema(request.event);

			if (!validEvent) {
				const lang = request.context.preferredLanguage;
				const localize =
					(Object.hasOwn(languages, lang) ? languages[lang] : undefined) ??
					languages[defaultLanguage];
				if (typeof localize === "function") {
					localize(eventSchema.errors);
				}

				// Bad Request
				throw createError(400, "Event object failed validation", {
					cause: {
						package: pkg,
						data: eventSchema.errors,
					},
				});
			}
		}

		if (contextSchema) {
			const validContext = contextSchema(request.context);

			if (!validContext) {
				// Internal Server Error
				throw createError(500, "Context object failed validation", {
					cause: {
						package: pkg,
						data: contextSchema.errors,
					},
				});
			}
		}
	};

	const validatorMiddlewareAfter = (request) => {
		const validResponse = responseSchema(request.response);

		if (!validResponse) {
			// Internal Server Error
			throw createError(500, "Response object failed validation", {
				cause: {
					package: pkg,
					data: responseSchema.errors,
				},
			});
		}
	};
	return {
		before:
			(eventSchema ?? contextSchema) ? validatorMiddlewareBefore : undefined,
		after: responseSchema ? validatorMiddlewareAfter : undefined,
	};
};

export default validatorMiddleware;
