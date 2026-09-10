// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import BusBoy from "@fastify/busboy";
import { HttpError, validateOptions } from "@middy/util";

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
			throw new HttpError(415, {
				cause: {
					package: pkg,
					data: { contentType },
				},
			});
		}

		if (typeof body === "undefined") {
			throw new HttpError(422, {
				cause: {
					package: pkg,
					data: {
						reason: "Invalid or malformed multipart/form-data was provided",
						body,
					},
				},
			});
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
				throw new HttpError(422, {
					cause: {
						package: pkg,
						data: {
							reason: "Invalid or malformed multipart/form-data was provided",
							body,
							message: err.message,
						},
					},
				});
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

		// Busboy fires `field`, `file` and `finish` from stream events on a later
		// tick than `busboy.write()`, so a throw inside one of them is not caught by
		// the promise executor: it escapes as an uncaughtException and the promise
		// never settles. Route it to reject instead.
		const guard =
			(fn) =>
			(...args) => {
				try {
					fn(...args);
				} catch (error) {
					reject(error);
				}
			};

		const tooLarge = (data) =>
			reject(new HttpError(413, { cause: { package: pkg, data } }));

		// busboy hands a part whose Content-Disposition has no `name` over with
		// `fieldname === undefined`. It has nothing to be stored under, so it is
		// the client's malformed form, not a limit it exceeded.
		const nameless = () =>
			reject(
				new HttpError(422, {
					cause: {
						package: pkg,
						data: { reason: "Multipart part is missing a field name" },
					},
				}),
			);

		// @fastify/busboy does not enforce fieldNameSize for multipart, so guard
		// here to bound attacker-controlled field-name length. Returns false once
		// the promise has been rejected so the listener stops there.
		const checkFieldName = (fieldname) => {
			if (typeof fieldname !== "string") {
				nameless();
				// Stryker disable next-line BooleanLiteral: equivalent mutant - nameless() has already rejected the promise, so whether the listener carries on only decides work whose outcome can no longer be observed.
				return false;
			}
			if (fieldname.length > fieldNameSize) {
				tooLarge({ limit: "fieldNameSize" });
				// Stryker disable next-line BooleanLiteral: equivalent mutant - tooLarge() has already rejected the promise, so whether the listener carries on only decides work whose outcome can no longer be observed.
				return false;
			}
			return true;
		};

		busboy
			.on(
				"file",
				guard((fieldname, file, filename, encoding, mimetype) => {
					// A body that ends inside this part makes busboy emit `error` on
					// the part stream on a later tick, after the parser's own error
					// has already rejected. Without a listener that second emit is an
					// uncaughtException, so it goes on before the field-name guard
					// can return early.
					file.on("error", reject);
					if (!checkFieldName(fieldname)) return;
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
					file.on(
						"end",
						guard(() => {
							if (file.truncated) {
								tooLarge({ filename });
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
						}),
					);
				}),
			)
			.on(
				"field",
				guard((fieldname, value, _nameTruncated, valTruncated) => {
					if (!checkFieldName(fieldname)) return;
					// Busboy clips the value at `fieldSize` and carries on; a clipped
					// value must fail loudly rather than reach the handler looking whole.
					if (valTruncated) {
						tooLarge({ fieldname });
						return;
					}
					const openBracket = fieldname.endsWith("]")
						? fieldname.lastIndexOf("[")
						: -1;
					if (openBracket < 1) {
						const current = multipartData[fieldname];
						if (Array.isArray(current)) {
							// `a[]` followed by `a`: the mirror of the fold below.
							current.push(value);
						} else {
							multipartData[fieldname] = value;
						}
						return;
					}
					const key = fieldname.slice(0, openBracket);
					const current = multipartData[key];
					if (current === undefined) {
						multipartData[key] = [value];
					} else if (Array.isArray(current)) {
						current.push(value);
					} else {
						// `a` followed by `a[]`: fold the scalar in, the same way a
						// repeated file field becomes an array.
						multipartData[key] = [current, value];
					}
				}),
			)
			// Past each of these busboy silently skips the excess parts, so the
			// handler would see a partial form and never know.
			.on("fieldsLimit", () => tooLarge({ limit: "fields" }))
			.on("filesLimit", () => tooLarge({ limit: "files" }))
			.on("partsLimit", () => tooLarge({ limit: "parts" }))
			.on(
				"finish",
				guard(() => resolve(multipartData)),
			)
			.on("error", (e) => reject(e));

		busboy.write(event.body, charset);
		busboy.end();
	});
};
export default httpMultipartBodyParserMiddleware;
