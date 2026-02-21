// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createError, decodeBody } from "@middy/util";

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
			throw createError(422, "Invalid or malformed JSON was provided", {
				cause: { package: "@middy/http-json-body-parser", data: body },
			});
		}

		try {
			const data = decodeBody(request.event);

			request.event.body = JSON.parse(data, options.reviver);
		} catch (err) {
			throw createError(422, "Invalid or malformed JSON was provided", {
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
