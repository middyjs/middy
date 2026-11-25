// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	decodeBody,
	HttpError,
	jsonContentTypePattern,
	jsonParseProtectProto,
	validateOptions,
} from "@middy/util";

const name = "http-json-body-parser";
const pkg = `@middy/${name}`;

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:http-json-body-parser:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		reviver: { $ref: "#/$defs/Function" },
		disableContentTypeCheck: { type: "boolean" },
		disableContentTypeError: { type: "boolean" },
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const httpJsonBodyParserValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const httpJsonBodyParserMiddleware = (opts = {}) => {
	const { reviver, disableContentTypeCheck, disableContentTypeError } = opts;
	const httpJsonBodyParserMiddlewareBefore = (request) => {
		const event = request.event;
		const { headers, body, isBase64Encoded } = event;
		const contentType = headers?.["content-type"] ?? headers?.["Content-Type"];

		if (!disableContentTypeCheck && !jsonContentTypePattern.test(contentType)) {
			if (disableContentTypeError) {
				return;
			}
			throw new HttpError(415, {
				cause: { package: pkg, data: { contentType } },
			});
		}

		if (typeof body === "undefined") {
			throw new HttpError(422, {
				cause: {
					package: pkg,
					data: { reason: "Invalid or malformed JSON was provided", body },
				},
			});
		}

		try {
			event.body = jsonParseProtectProto(
				decodeBody(body, isBase64Encoded),
				reviver,
				pkg,
			);
		} catch (err) {
			// Re-throw a forbidden-key rejection as-is; only wrap genuine parse errors.
			if (err.statusCode) {
				throw err;
			}
			throw new HttpError(422, {
				cause: {
					package: pkg,
					data: {
						reason: "Invalid or malformed JSON was provided",
						body,
						message: err.message,
					},
				},
			});
		}
	};

	return {
		before: httpJsonBodyParserMiddlewareBefore,
	};
};
export default httpJsonBodyParserMiddleware;
