// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { HttpError, validateOptions } from "@middy/util";

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
	const params = request.event.pathParameters;
	if (!params) return;
	for (const key of Object.keys(params)) {
		const value = params[key];
		if (typeof value !== "string") continue;
		try {
			params[key] = decodeURIComponent(value);
		} catch (_e) {
			throw new HttpError(400, {
				cause: {
					package: pkg,
					data: { reason: "Invalid path parameter encoding", key },
				},
			});
		}
	}
};

const httpUrlencodePathParserMiddleware = () => ({
	before: httpUrlencodePathParserMiddlewareBefore,
});
export default httpUrlencodePathParserMiddleware;
