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
		maxKeys: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
	},
	additionalProperties: false,
};

export const httpUrlencodeBodyParserValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);
// Counts `&`-separated fields, stopping as soon as the count passes `limit`,
// so an oversized body costs no more than the scan up to the limit.
const exceedsFieldLimit = (body, limit) => {
	let count = 1;
	let index = body.indexOf("&");
	while (index !== -1) {
		count += 1;
		if (count > limit) return true;
		index = body.indexOf("&", index + 1);
	}
	return false;
};

const httpUrlencodeBodyParserMiddleware = (opts = {}) => {
	const {
		disableContentTypeCheck,
		disableContentTypeError,
		maxKeys = 1000,
	} = opts;
	// Checked before parsing, so the cap never truncates in silence; the
	// parser's own cap is lifted since the count is already bounded.
	const parseOptions = { maxKeys: 0 };

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
		// A form over `maxKeys` fields is refused rather than parsed: the
		// parser's default would drop every later field without an error, and no
		// cap at all lets a 6 MB body of empty pairs build over a million keys.
		const decoded = decodeBody(body, isBase64Encoded);
		if (typeof decoded === "string" && exceedsFieldLimit(decoded, maxKeys)) {
			throw new HttpError(413, {
				cause: { package: pkg, data: { limit: "maxKeys", maxKeys } },
			});
		}
		event.body = parseQuery(decoded, undefined, undefined, parseOptions);
	};

	return {
		before: httpUrlencodeBodyParserMiddlewareBefore,
	};
};

export default httpUrlencodeBodyParserMiddleware;
