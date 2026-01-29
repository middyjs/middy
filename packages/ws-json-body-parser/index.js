// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createError } from "@middy/util";

const defaults = {
	reviver: undefined,
};

const wsJsonBodyParserMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const wsJsonBodyParserMiddlewareBefore = async (request) => {
		const { body } = request.event;
		if (typeof body === "undefined") {
			throw createError(422, "Invalid or malformed JSON was provided", {
				cause: { package: "@middy/ws-json-body-parser", data: body },
			});
		}

		try {
			const data = request.event.isBase64Encoded
				? Buffer.from(body, "base64").toString()
				: body;

			request.event.body = JSON.parse(data, options.reviver);
		} catch (err) {
			// UnprocessableEntity
			throw createError(422, "Invalid or malformed JSON was provided", {
				cause: {
					package: "@middy/ws-json-body-parser",
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
