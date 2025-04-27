import { createError } from "@middy/util";

const defaults = {
	eventSchema: undefined,
	contextSchema: undefined,
	responseSchema: undefined,
	defaultLanguage: "en",
	languages: {},
};

const validatorMiddleware = (opts = {}) => {
	const {
		eventSchema,
		contextSchema,
		responseSchema,
		defaultLanguage,
		languages,
	} = { ...defaults, ...opts };

	const validatorMiddlewareBefore = async (request) => {
		if (eventSchema) {
			const validEvent = await eventSchema(request.event);

			if (!validEvent) {
				const localize =
					languages[request.context.preferredLanguage] ??
					languages[defaultLanguage];
				localize?.(eventSchema.errors);

				// Bad Request
				throw createError(400, "Event object failed validation", {
					cause: {
						package: "@middy/validator",
						data: eventSchema.errors,
					},
				});
			}
		}

		if (contextSchema) {
			const validContext = await contextSchema(request.context);

			if (!validContext) {
				// Internal Server Error
				throw createError(500, "Context object failed validation", {
					cause: {
						package: "@middy/validator",
						data: contextSchema.errors,
					},
				});
			}
		}
	};

	const validatorMiddlewareAfter = async (request) => {
		const validResponse = await responseSchema(request.response);

		if (!validResponse) {
			// Internal Server Error
			throw createError(500, "Response object failed validation", {
				cause: {
					package: "@middy/validator",
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
