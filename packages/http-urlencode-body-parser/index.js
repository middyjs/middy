// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { parse as parseQuery } from "node:querystring";
import { decodeBody, HttpError, validateOptions } from "@middy/util";

const name = "http-urlencode-body-parser";
const pkg = `@middy/${name}`;

const mimePattern = /^application\/x-www-form-urlencoded(;.*)?$/i;
const optionSchema = {
	type: "object",
	properties: {
		disableContentTypeCheck: { type: "boolean" },
		disableContentTypeError: { type: "boolean" },
	},
	additionalProperties: false,
};

export const httpUrlencodeBodyParserValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);
const httpUrlencodeBodyParserMiddleware = (opts = {}) => {
	const { disableContentTypeCheck, disableContentTypeError } = opts;

	const httpUrlencodeBodyParserMiddlewareBefore = (request) => {
		const event = request.event;
		const { headers, body, isBase64Encoded } = event;

		const contentType = headers?.["content-type"] ?? headers?.["Content-Type"];

		if (!disableContentTypeCheck && !mimePattern.test(contentType)) {
			if (disableContentTypeError) {
				return;
			}
			throw new HttpError(415, {
				cause: {
					package: pkg,
					data: { contentType },
				},
			});
		}

		// `querystring.parse` returns a null-prototype object and represents
		// duplicates as arrays, matching the previous URLSearchParams loop's
		// semantics in one native call. It is total (never throws) and the
		// Content-Type check above is the real gate, so there is no reliable
		// "malformed" signal to detect here. The previous heuristic both
		// rejected valid single-field forms and admitted non-form input, and
		// echoed the raw body into the error, so it has been removed.
		event.body = parseQuery(decodeBody(body, isBase64Encoded));
	};

	return {
		before: httpUrlencodeBodyParserMiddlewareBefore,
	};
};

export default httpUrlencodeBodyParserMiddleware;
