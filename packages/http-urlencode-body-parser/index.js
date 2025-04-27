import querystring from "node:querystring";
import { createError } from "@middy/util";

const mimePattern = /^application\/x-www-form-urlencoded(;.*)?$/;
const defaults = {
	disableContentTypeError: false,
};
const httpUrlencodeBodyParserMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const httpUrlencodeBodyParserMiddlewareBefore = async (request) => {
		const { headers, body } = request.event;

		const contentType = headers?.["content-type"] ?? headers?.["Content-Type"];

		if (!mimePattern.test(contentType)) {
			if (options.disableContentTypeError) {
				return;
			}
			throw createError(415, "Unsupported Media Type", {
				cause: {
					package: "@middy/http-urlencode-body-parser",
					data: contentType,
				},
			});
		}

		const data = request.event.isBase64Encoded
			? Buffer.from(body, "base64").toString()
			: body;

		const rawBody = body;
		request.event.body = Object.assign({}, querystring.parse(data));

		if (request.event.body?.[rawBody] === "") {
			// UnprocessableEntity
			throw createError(
				415,
				"Invalid or malformed URL encoded form was provided",
				{ cause: { package: "@middy/http-urlencode-body-parser", data: body } },
			);
		}
	};

	return {
		before: httpUrlencodeBodyParserMiddlewareBefore,
	};
};

export default httpUrlencodeBodyParserMiddleware;
