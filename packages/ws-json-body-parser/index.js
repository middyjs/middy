// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	createError,
	decodeBody,
	jsonParseProtectProto,
	validateOptions,
} from "@middy/util";

const name = "ws-json-body-parser";
const pkg = `@middy/${name}`;

// Stryker disable next-line ObjectLiteral: `reviver: undefined` documents the only option; emptying the object yields an identical `options.reviver` after spread (no observable difference).
const defaults = {
	reviver: undefined,
};

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
	const options = { ...defaults, ...opts };
	const reviver = options.reviver;
	const wsJsonBodyParserMiddlewareBefore = (request) => {
		const event = request.event;
		const { body, isBase64Encoded } = event;
		if (typeof body === "undefined") {
			throw createError(422, "Invalid or malformed JSON was provided", {
				cause: { package: pkg, data: body },
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
		before: wsJsonBodyParserMiddlewareBefore,
	};
};
export default wsJsonBodyParserMiddleware;
