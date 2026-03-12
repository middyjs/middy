// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import BusBoy from "@fastify/busboy";
import { createError } from "@middy/util";

const mimePattern =
	/^multipart\/form-data; boundary=[a-zA-Z0-9-]{1,70}(; ?charset=[\w-]+)?$/i;
const fieldnamePattern = /(.+)\[(.*)]$/;

const defaults = {
	// busboy options as per documentation: https://www.npmjs.com/package/busboy#busboy-methods
	busboy: {},
	charset: "utf8",
	disableContentTypeCheck: false,
	disableContentTypeError: false,
};

const httpMultipartBodyParserMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const httpMultipartBodyParserMiddlewareBefore = (request) => {
		const { headers, body } = request.event;

		const contentType = headers?.["content-type"] ?? headers?.["Content-Type"];

		if (!options.disableContentTypeCheck && !mimePattern.test(contentType)) {
			if (options.disableContentTypeError) {
				return;
			}
			throw createError(415, "Unsupported Media Type", {
				cause: {
					package: "@middy/http-multipart-body-parser",
					data: contentType,
				},
			});
		}

		if (typeof body === "undefined") {
			throw createError(
				422,
				"Invalid or malformed multipart/form-data was provided",
				{ cause: { package: "@middy/http-multipart-body-parser", data: body } },
			);
		}

		return parseMultipartData(request.event, options)
			.then((multipartData) => {
				request.event.body = multipartData;
			})
			.catch((err) => {
				// UnprocessableEntity
				throw createError(
					422,
					"Invalid or malformed multipart/form-data was provided",
					{
						cause: {
							package: "@middy/http-multipart-body-parser",
							data: body,
							message: err.message,
						},
					},
				);
			});
	};

	return {
		before: httpMultipartBodyParserMiddlewareBefore,
	};
};

const parseMultipartData = (event, options) => {
	const multipartData = Object.create(null);
	const charset = event.isBase64Encoded ? "base64" : options.charset;
	// header must be lowercase (content-type)
	const busboy = BusBoy({
		...options.busboy,
		headers: {
			"content-type":
				event.headers?.["content-type"] ?? event.headers?.["Content-Type"],
		},
	});

	return new Promise((resolve, reject) => {
		busboy
			.on("file", (fieldname, file, filename, encoding, mimetype) => {
				const attachment = {
					filename,
					mimetype,
					encoding,
				};

				const chunks = [];

				file.on("data", (data) => {
					chunks.push(data);
				});
				file.on("end", () => {
					attachment.truncated = file.truncated;
					attachment.content = Buffer.concat(chunks);
					if (!multipartData[fieldname]) {
						multipartData[fieldname] = attachment;
					} else {
						const current = multipartData[fieldname];
						multipartData[fieldname] = [attachment].concat(current);
					}
				});
			})
			.on("field", (fieldname, value) => {
				const matches = fieldname.match(fieldnamePattern);
				if (!matches) {
					multipartData[fieldname] = value;
				} else {
					if (!multipartData[matches[1]]) {
						multipartData[matches[1]] = [];
					}
					multipartData[matches[1]].push(value);
				}
			})
			.on("finish", () => resolve(multipartData))
			.on("error", (e) => reject(e));

		busboy.write(event.body, charset);
		busboy.end();
	});
};
export default httpMultipartBodyParserMiddleware;
