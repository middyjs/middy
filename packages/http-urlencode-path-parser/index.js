// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createError } from "@middy/util";

const httpUrlencodePathParserMiddlewareBefore = async (request) => {
	if (!request.event.pathParameters) return;
	for (const key of Object.keys(request.event.pathParameters)) {
		try {
			request.event.pathParameters[key] = decodeURIComponent(
				request.event.pathParameters[key],
			);
		} catch (_e) {
			throw createError(400, "Invalid path parameter encoding", {
				cause: { package: "@middy/http-urlencode-path-parser", data: key },
			});
		}
	}
};

const httpUrlencodePathParserMiddleware = () => ({
	before: httpUrlencodePathParserMiddlewareBefore,
});
export default httpUrlencodePathParserMiddleware;
