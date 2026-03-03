// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createError, decodeBody } from "@middy/util";

const mimePattern = /^application\/x-www-form-urlencoded(;.*)?$/i;
const defaults = {
	disableContentTypeCheck: false,
	disableContentTypeError: false,
};
const httpUrlencodeBodyParserMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const httpUrlencodeBodyParserMiddlewareBefore = (request) => {
		const { headers, body } = request.event;

		const contentType = headers?.["content-type"] ?? headers?.["Content-Type"];

		if (!options.disableContentTypeCheck && !mimePattern.test(contentType)) {
			if (options.disableContentTypeError) {
				return;
			}
			throw createError(415, "Unsupported Media Type", {
				cause: {
					package: "@middy/http-urlencode-body-parser",
					data: contentType,
				},
			});
		}

		const data = decodeBody(request.event);
		const parsedBody = Object.fromEntries(new URLSearchParams(data));

		// Check if it didn't parse
		if (parsedBody?.[body] === "") {
			throw createError(
				422,
				"Invalid or malformed URL encoded form was provided",
				{ cause: { package: "@middy/http-urlencode-body-parser", data: body } },
			);
		}

		request.event.body = Object.assign(Object.create(null), parsedBody);
	};

	return {
		before: httpUrlencodeBodyParserMiddlewareBefore,
	};
};

export default httpUrlencodeBodyParserMiddleware;
