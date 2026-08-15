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
	const params = request.event.pathParameters;
	if (!params) return;
	for (const key of Object.keys(params)) {
		const value = params[key];
		// Fast-path: most API Gateway path params are plain ASCII (UUIDs,
		// numeric IDs, slugs). Skip the native decodeURIComponent + property
		// write entirely when there's no `%` to decode.
		// Stryker disable next-line ConditionalExpression,StringLiteral: the no-'%' branch is a perf-only fast-path; decodeURIComponent leaves any string without '%' unchanged and never throws, so skipping vs decoding it is behaviorally indistinguishable in the output.
		if (typeof value !== "string" || value.indexOf("%") === -1) continue;
		try {
			params[key] = decodeURIComponent(value);
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
