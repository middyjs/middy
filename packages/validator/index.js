// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { HttpError, validateOptions } from "@middy/util";

const name = "validator";
const pkg = `@middy/${name}`;

const defaults = {
	eventSchema: undefined,
	contextSchema: undefined,
	responseSchema: undefined,
	defaultLanguage: "en",
	languages: {},
	// Where @middy/http-content-negotiation published its results; must match
	// that middleware's `contextKey` when it has been overridden.
	contextKeyHttpContentNegotiation: "http-content-negotiation",
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
		contextKeyHttpContentNegotiation: { type: "string" },
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
		contextKeyHttpContentNegotiation,
	} = { ...defaults, ...opts };

	// AJV `$async` validators return a promise (and throw on invalid) instead of
	// a boolean, so the synchronous validation paths below would silently treat
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
		if (schema?.constructor?.name === "AsyncFunction") {
			throw new Error(
				`${pkg} ${label} is an async function; validators must return a boolean synchronously`,
				{ cause: { package: pkg } },
			);
		}
	}

	const assertSyncResult = (label, valid) => {
		if (typeof valid?.then === "function") {
			throw new Error(
				`${pkg} ${label} returned a promise; validators must return a boolean synchronously`,
				{ cause: { package: pkg } },
			);
		}
	};

	const validatorMiddlewareBefore = (request) => {
		if (eventSchema) {
			// AJV-compiled validators are synchronous (unless `$async`);
			// dropping `await` skips a per-hook microtask on the warm path.
			const validEvent = eventSchema(request.event);
			assertSyncResult("eventSchema", validEvent);

			if (!validEvent) {
				const lang =
					request.context.middyContext?.[contextKeyHttpContentNegotiation]
						?.preferredLanguage;
				const localize =
					(Object.hasOwn(languages, lang) ? languages[lang] : undefined) ??
					languages[defaultLanguage];
				if (typeof localize === "function") {
					localize(eventSchema.errors);
				}

				// Bad Request
				throw new HttpError(400, {
					cause: {
						package: pkg,
						data: {
							reason: "Event object failed validation",
							errors: eventSchema.errors,
						},
					},
				});
			}
		}

		if (contextSchema) {
			const validContext = contextSchema(request.context);
			assertSyncResult("contextSchema", validContext);

			if (!validContext) {
				// Internal Server Error
				throw new HttpError(500, {
					cause: {
						package: pkg,
						data: {
							reason: "Context object failed validation",
							errors: contextSchema.errors,
						},
					},
				});
			}
		}
	};

	const validatorMiddlewareAfter = (request) => {
		const validResponse = responseSchema(request.response);
		assertSyncResult("responseSchema", validResponse);

		if (!validResponse) {
			// Internal Server Error
			throw new HttpError(500, {
				cause: {
					package: pkg,
					data: {
						reason: "Response object failed validation",
						errors: responseSchema.errors,
					},
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
