import { createError } from "@middy/util";

const mimePattern = /^application\/(.+\+)?json($|;.+)/;

const defaults = {
	reviver: undefined,
	disableContentTypeCheck: false,
	disableContentTypeError: false,
};

const httpJsonBodyParserMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const httpJsonBodyParserMiddlewareBefore = async (request) => {
		const { headers, body } = request.event;
		const contentType = headers?.["content-type"] ?? headers?.["Content-Type"];

		if (!options.disableContentTypeCheck && !mimePattern.test(contentType)) {
			if (options.disableContentTypeError) {
				return;
			}
			throw createError(415, "Unsupported Media Type", {
				cause: { package: "@middy/http-json-body-parser", data: contentType },
			});
		}

		if (typeof body === "undefined") {
			throw createError(415, "Invalid or malformed JSON was provided", {
				cause: { package: "@middy/http-json-body-parser", data: body },
			});
		}

		try {
			const data = request.event.isBase64Encoded
				? Buffer.from(body, "base64").toString()
				: body;

			request.event.body = JSON.parse(data, options.reviver);
		} catch (err) {
			// UnprocessableEntity
			throw createError(415, "Invalid or malformed JSON was provided", {
				cause: {
					package: "@middy/http-json-body-parser",
					data: body,
					message: err.message,
				},
			});
		}
	};

	return {
		before: httpJsonBodyParserMiddlewareBefore,
	};
};
export default httpJsonBodyParserMiddleware;
