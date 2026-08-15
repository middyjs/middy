// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import BusBoy from "@fastify/busboy";
import { createError, validateOptions } from "@middy/util";

const name = "http-multipart-body-parser";
const pkg = `@middy/${name}`;

const mimePattern =
	/^multipart\/form-data; boundary=[a-zA-Z0-9-]{1,70}(; ?charset=[\w-]+)?$/i;

const optionSchema = {
	type: "object",
	properties: {
		busboy: {
			type: "object",
			properties: {
				headers: { type: "object", additionalProperties: true },
				highWaterMark: { type: "integer", minimum: 1 },
				fileHwm: { type: "integer", minimum: 1 },
				defCharset: { type: "string" },
				defParamCharset: { type: "string" },
				preservePath: { type: "boolean" },
				isPartAFile: { instanceof: "Function" },
				limits: {
					type: "object",
					properties: {
						fieldNameSize: { type: "integer", minimum: 0 },
						fieldSize: { type: "integer", minimum: 0 },
						fields: { type: "integer", minimum: 0 },
						fileSize: { type: "integer", minimum: 0 },
						files: { type: "integer", minimum: 0 },
						parts: { type: "integer", minimum: 0 },
						headerPairs: { type: "integer", minimum: 0 },
					},
					additionalProperties: true,
				},
			},
			additionalProperties: true,
		},
		charset: { type: "string" },
		disableContentTypeCheck: { type: "boolean" },
		disableContentTypeError: { type: "boolean" },
	},
	additionalProperties: false,
};

export const httpMultipartBodyParserValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const defaults = {
	// busboy options as per documentation: https://www.npmjs.com/package/busboy#busboy-methods
	busboy: {},
	// Stryker disable next-line StringLiteral: Node treats an empty-string encoding as the default utf8 for both Buffer.from and stream.write, so "" and "utf8" produce byte-identical results here (no observable behavior change).
	charset: "utf8",
	disableContentTypeCheck: false,
	disableContentTypeError: false,
};

const defaultLimits = {
	fieldNameSize: 100,
	fields: 1000,
	parts: 1000,
};

const httpMultipartBodyParserMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	options.busboy = {
		...options.busboy,
		limits: { ...defaultLimits, ...options.busboy.limits },
	};

	const httpMultipartBodyParserMiddlewareBefore = (request) => {
		const { headers, body } = request.event;

		const contentType = headers?.["content-type"] ?? headers?.["Content-Type"];

		if (!options.disableContentTypeCheck && !mimePattern.test(contentType)) {
			if (options.disableContentTypeError) {
				return;
			}
			throw createError(415, "Unsupported Media Type", {
				cause: {
					package: pkg,
					data: contentType,
				},
			});
		}

		if (typeof body === "undefined") {
			throw createError(
				422,
				"Invalid or malformed multipart/form-data was provided",
				{ cause: { package: pkg, data: body } },
			);
		}

		return parseMultipartData(request.event, options)
			.then((multipartData) => {
				request.event.body = multipartData;
			})
			.catch((err) => {
				if (typeof err.statusCode !== "undefined") {
					throw err;
				}
				// UnprocessableEntity
				throw createError(
					422,
					"Invalid or malformed multipart/form-data was provided",
					{
						cause: {
							package: pkg,
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
	const fieldNameSize = options.busboy.limits.fieldNameSize;

	return new Promise((resolve, reject) => {
		let busboy;
		try {
			busboy = BusBoy({
				...options.busboy,
				headers: {
					"content-type":
						event.headers?.["content-type"] ?? event.headers?.["Content-Type"],
				},
			});
		} catch (error) {
			reject(error);
			return;
		}

		busboy
			.on("file", (fieldname, file, filename, encoding, mimetype) => {
				// @fastify/busboy does not enforce fieldNameSize for multipart, so
				// guard here to bound attacker-controlled field-name length.
				if (fieldname.length > fieldNameSize) {
					reject(new Error("Field name size limit exceeded"));
					return;
				}
				const attachment = {
					filename,
					mimetype,
					encoding,
				};

				const chunks = [];
				let totalLength = 0;

				file.on("data", (data) => {
					chunks.push(data);
					totalLength += data.length;
				});
				file.on("end", () => {
					if (file.truncated) {
						reject(
							createError(413, "Request Entity Too Large", {
								cause: { package: pkg, data: filename },
							}),
						);
						return;
					}
					attachment.truncated = file.truncated;
					// Pass total length to skip Buffer.concat's prepass scan.
					attachment.content = Buffer.concat(chunks, totalLength);
					const current = multipartData[fieldname];
					if (current === undefined) {
						multipartData[fieldname] = attachment;
					} else if (Array.isArray(current)) {
						// Preserve historical semantics: new attachment first.
						current.unshift(attachment);
					} else {
						multipartData[fieldname] = [attachment, current];
					}
				});
			})
			.on("field", (fieldname, value) => {
				// @fastify/busboy does not enforce fieldNameSize for multipart, so
				// guard here to bound attacker-controlled field-name length.
				if (fieldname.length > fieldNameSize) {
					reject(new Error("Field name size limit exceeded"));
					return;
				}
				const openBracket = fieldname.endsWith("]")
					? fieldname.lastIndexOf("[")
					: -1;
				if (openBracket < 1) {
					multipartData[fieldname] = value;
				} else {
					const key = fieldname.slice(0, openBracket);
					if (!multipartData[key]) {
						multipartData[key] = [];
					}
					multipartData[key].push(value);
				}
			})
			.on("finish", () => resolve(multipartData))
			.on("error", (e) => reject(e));

		busboy.write(event.body, charset);
		busboy.end();
	});
};
export default httpMultipartBodyParserMiddleware;
