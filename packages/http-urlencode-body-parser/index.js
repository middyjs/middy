// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createError, decodeBody, validateOptions } from "@middy/util";

const mimePattern = /^application\/x-www-form-urlencoded(;.*)?$/i;
const defaults = {
	disableContentTypeCheck: false,
	disableContentTypeError: false,
};

const optionSchema = {
	type: "object",
	properties: {
		disableContentTypeCheck: { type: "boolean" },
		disableContentTypeError: { type: "boolean" },
	},
	additionalProperties: false,
};

export const httpUrlencodeBodyParserValidateOptions = (options) =>
	validateOptions("@middy/http-urlencode-body-parser", optionSchema, options);
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
		const parsedBody = Object.create(null);
		for (const [key, value] of new URLSearchParams(data)) {
			if (Object.hasOwn(parsedBody, key)) {
				parsedBody[key] = Array.isArray(parsedBody[key])
					? [...parsedBody[key], value]
					: [parsedBody[key], value];
			} else {
				parsedBody[key] = value;
			}
		}

		// Check if it didn't parse
		if (parsedBody?.[body] === "") {
			throw createError(
				422,
				"Invalid or malformed URL encoded form was provided",
				{ cause: { package: "@middy/http-urlencode-body-parser", data: body } },
			);
		}

		request.event.body = parsedBody;
	};

	return {
		before: httpUrlencodeBodyParserMiddlewareBefore,
	};
};

export default httpUrlencodeBodyParserMiddleware;
