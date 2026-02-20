// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import querystring from "node:querystring";
import { createError } from "@middy/util";

const mimePattern = /^application\/x-www-form-urlencoded(;.*)?$/;
const defaults = {
	disableContentTypeError: false,
};
const httpUrlencodeBodyParserMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const httpUrlencodeBodyParserMiddlewareBefore = async (request) => {
		const { headers, body } = request.event;

		const contentType = headers?.["content-type"] ?? headers?.["Content-Type"];

		if (!mimePattern.test(contentType)) {
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

		const data = request.event.isBase64Encoded
			? Buffer.from(body, "base64").toString()
			: body;

		request.event.body = querystring.parse(data);
		// Check if it didn't parse
		if (request.event.body?.[body] === "") {
			throw createError(
				415,
				"Invalid or malformed URL encoded form was provided",
				{ cause: { package: "@middy/http-urlencode-body-parser", data: body } },
			);
		}
	};

	return {
		before: httpUrlencodeBodyParserMiddlewareBefore,
	};
};

export default httpUrlencodeBodyParserMiddleware;
