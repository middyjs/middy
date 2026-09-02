// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	decodeBody,
	HttpError,
	jsonParseProtectProto,
	validateOptions,
} from "@middy/util";

const name = "ws-json-body-parser";
const pkg = `@middy/${name}`;

const optionSchema = {
	type: "object",
	properties: {
		reviver: { instanceof: "Function" },
	},
	additionalProperties: false,
};

export const wsJsonBodyParserValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const wsJsonBodyParserMiddleware = (opts = {}) => {
	const { reviver } = opts;
	const wsJsonBodyParserMiddlewareBefore = (request) => {
		const event = request.event;
		const { body, isBase64Encoded } = event;
		if (typeof body === "undefined") {
			throw new HttpError(422, {
				cause: {
					package: pkg,
					data: { reason: "Invalid or malformed JSON was provided", body },
				},
			});
		}

		try {
			// Parses while rejecting prototype-pollution payloads (see util).
			const data = decodeBody(body, isBase64Encoded);
			event.body = jsonParseProtectProto(data, reviver, pkg);
		} catch (err) {
			// Re-throw a forbidden-key rejection as-is; only wrap genuine parse errors.
			if (err.statusCode) {
				throw err;
			}
			// UnprocessableEntity
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
		before: wsJsonBodyParserMiddlewareBefore,
	};
};
export default wsJsonBodyParserMiddleware;
