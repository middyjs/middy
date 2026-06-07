// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	createError,
	decodeBody,
	jsonContentTypePattern,
	jsonParseProtectProto,
	validateOptions,
} from "@middy/util";

const name = "http-json-body-parser";
const pkg = `@middy/${name}`;

// Stryker disable next-line ObjectLiteral: replacing the defaults with `{}` is equivalent: reviver/disableContentTypeCheck/disableContentTypeError are only ever read via truthiness, and absent keys are also falsy/undefined.
const defaults = {
	reviver: undefined,
	disableContentTypeCheck: false,
	disableContentTypeError: false,
};

const optionSchema = {
	type: "object",
	properties: {
		reviver: { instanceof: "Function" },
		disableContentTypeCheck: { type: "boolean" },
		disableContentTypeError: { type: "boolean" },
	},
	additionalProperties: false,
};

export const httpJsonBodyParserValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const httpJsonBodyParserMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const { reviver } = options;
	const httpJsonBodyParserMiddlewareBefore = (request) => {
		const event = request.event;
		const { headers, body, isBase64Encoded } = event;
		const contentType = headers?.["content-type"] ?? headers?.["Content-Type"];

		if (
			!options.disableContentTypeCheck &&
			!jsonContentTypePattern.test(contentType)
		) {
			if (options.disableContentTypeError) {
				return;
			}
			throw createError(415, "Unsupported Media Type", {
				cause: { package: pkg, data: contentType },
			});
		}

		if (typeof body === "undefined") {
			throw createError(422, "Invalid or malformed JSON was provided", {
				cause: { package: pkg, data: body },
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
			throw createError(422, "Invalid or malformed JSON was provided", {
				cause: {
					package: pkg,
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
