// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createError, validateOptions } from "@middy/util";

const name = "http-urlencode-path-parser";
const pkg = `@middy/${name}`;

const optionSchema = {
	type: "object",
	properties: {},
	additionalProperties: false,
};

export const httpUrlencodePathParserValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const httpUrlencodePathParserMiddlewareBefore = (request) => {
	if (!request.event.pathParameters) return;
	for (const key of Object.keys(request.event.pathParameters)) {
		try {
			request.event.pathParameters[key] = decodeURIComponent(
				request.event.pathParameters[key],
			);
		} catch (_e) {
			throw createError(400, "Invalid path parameter encoding", {
				cause: { package: pkg, data: key },
			});
		}
	}
};

const httpUrlencodePathParserMiddleware = () => ({
	before: httpUrlencodePathParserMiddlewareBefore,
});
export default httpUrlencodePathParserMiddleware;
