import {
	deepStrictEqual,
	notStrictEqual,
	ok,
	strictEqual,
} from "node:assert/strict";
import { describe, test } from "node:test";
import middy from "../core/index.js";
import httpMultipartBodyParser, {
	httpMultipartBodyParserValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

describe("@middy/http-multipart-body-parser", () => {
	test("It should parse a non-file field from a multipart/form-data request", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser());

		// invokes the handler
		// Base64 encoded form data with field 'foo' of value 'bar'
		const event = {
			headers: {
				"content-type":
					"multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M",
			},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t",
			isBase64Encoded: true,
		};
		const response = await handler(event, defaultContext);

		deepStrictEqual(
			response,
			Object.assign(Object.create(null), { foo: "bar" }),
		);
	});

	test("parseMultipartData should resolve with valid data", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"Content-Type":
					"multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M",
			},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t",
			isBase64Encoded: true,
		};

		const response = await handler(event, defaultContext);
		deepStrictEqual(
			response,
			Object.assign(Object.create(null), { foo: "bar" }),
		);
	});

	test("It should parse a file field from a multipart/form-data request", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser());

		// Base64 encoded form data with a file with fieldname 'attachment', filename 'test.txt', and contents 'hello world!'
		const event = {
			headers: {
				"Content-Type":
					"multipart/form-data; boundary=------------------------4f0e69e6c2513684",
			},
			body: "LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS00ZjBlNjllNmMyNTEzNjg0DQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImF0dGFjaG1lbnQiOyBmaWxlbmFtZT0idGVzdC50eHQiDQpDb250ZW50LVR5cGU6IHRleHQvcGxhaW4NCg0KaGVsbG8gd29ybGQhCg0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS00ZjBlNjllNmMyNTEzNjg0LS0NCg==",
			isBase64Encoded: true,
		};

		const response = await handler(event, defaultContext);

		notStrictEqual(response.attachment, undefined);
		notStrictEqual(response.attachment.content, undefined);
	});

	test("It should handle invalid form data (undefined) as an UnprocessableEntity", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser());

		// invokes the handler
		const event = {
			headers: {
				"Content-Type":
					"multipart/form-data; boundary=------WebKitFormBoundaryfdmza9FgfefwkQzA",
			},
			body: undefined,
			isBase64Encoded: true,
		};

		try {
			await handler(event, defaultContext);
		} catch (e) {
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			strictEqual(
				e.cause.data.reason,
				"Invalid or malformed multipart/form-data was provided",
			);
			strictEqual(e.cause.data.body, undefined);
		}
	});

	test("It should handle invalid form data (null) as an UnprocessableEntity", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser());

		// invokes the handler
		const event = {
			headers: {
				"Content-Type":
					"multipart/form-data; boundary=------WebKitFormBoundaryfdmza9FgfefwkQzA",
			},
			body: null,
			isBase64Encoded: true,
		};

		try {
			await handler(event, defaultContext);
		} catch (e) {
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			strictEqual(
				e.cause.data.reason,
				"Invalid or malformed multipart/form-data was provided",
			);
			strictEqual(e.cause.data.message, "May not write null values to stream");
		}
	});

	test("It should handle more invalid form data as an UnprocessableEntity", async (t) => {
		// Body contains LF instead of CRLF line endings, which cant be processed
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"Content-Type":
					"multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M",
			},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0=",
			isBase64Encoded: true,
		};

		try {
			await handler(event, defaultContext);
		} catch (e) {
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			strictEqual(
				e.cause.data.reason,
				"Invalid or malformed multipart/form-data was provided",
			);
			strictEqual(e.cause.data.message, "Unexpected end of multipart data");
		}
	});

	test("It shouldn't process the body if no headers are passed", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser({ disableContentTypeError: false }));

		// invokes the handler
		const event = {
			headers: {},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0=",
		};

		try {
			await handler(event, defaultContext);
		} catch (e) {
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			strictEqual(e.cause.data.contentType, undefined);
		}
	});

	test("It shouldn't process the body if the content type is not multipart/form-data", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser({ disableContentTypeError: false }));

		// invokes the handler
		const event = {
			headers: {
				"Content-Type": "application/json",
			},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0=",
		};

		try {
			await handler(event, defaultContext);
		} catch (e) {
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
			strictEqual(e.cause.data.contentType, "application/json");
		}
	});

	test("It shouldn't process the body if headers are passed without content type", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser({ disableContentTypeError: true }));

		// invokes the handler
		const event = {
			headers: {
				accept: "application/json",
			},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0=",
		};

		const response = await handler(event, defaultContext);
		strictEqual(
			response,
			"LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0=",
		);
	});

	test("It shouldn't process the body and throw error if no header is passed", async (t) => {
		const handler = middy((event) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser({ disableContentTypeError: false }));

		// invokes the handler
		const event = {
			headers: {
				accept: "application/json",
			},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvbyIKCmJhcgotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNLS0=",
		};

		try {
			await handler(event, defaultContext);
		} catch (e) {
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
			strictEqual(e.cause.data.contentType, undefined);
		}
	});

	test("It should reject a field name larger than the default fieldNameSize cap", async (t) => {
		// @fastify/busboy does not enforce limits.fieldNameSize for multipart, so a
		// conservative default cap (100) is enforced by the middleware and an
		// over-cap field name is a 413 like every other exceeded limit.
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const longName = "n".repeat(200);
		const event = {
			headers: {
				"content-type": "multipart/form-data; boundary=TEST",
			},
			body: `--TEST\r\nContent-Disposition: form-data; name="${longName}"\r\n\r\nval\r\n--TEST--`,
			isBase64Encoded: false,
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 413);
			strictEqual(e.message, "Payload Too Large");
			deepStrictEqual(e.cause.data, { limit: "fieldNameSize" });
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
		}
	});

	test("It should reject a file field name larger than the configured fieldNameSize cap", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(
			httpMultipartBodyParser({ busboy: { limits: { fieldNameSize: 5 } } }),
		);

		const longName = "attachment";
		const event = {
			headers: {
				"content-type": "multipart/form-data; boundary=TEST",
			},
			body: `--TEST\r\nContent-Disposition: form-data; name="${longName}"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--TEST--`,
			isBase64Encoded: false,
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 413);
			deepStrictEqual(e.cause.data, { limit: "fieldNameSize" });
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
		}
	});

	test("It should allow a field name within an increased fieldNameSize cap", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(
			httpMultipartBodyParser({ busboy: { limits: { fieldNameSize: 300 } } }),
		);

		const longName = "n".repeat(200);
		const event = {
			headers: {
				"content-type": "multipart/form-data; boundary=TEST",
			},
			body: `--TEST\r\nContent-Disposition: form-data; name="${longName}"\r\n\r\nval\r\n--TEST--`,
			isBase64Encoded: false,
		};

		const response = await handler(event, defaultContext);
		strictEqual(response[longName], "val");
	});

	test("It should parse a bracket-heavy field name with no closing bracket in linear time", async (t) => {
		// A field name of many '[' with no closing ']' caused catastrophic
		// (super-linear) backtracking in the old /(.+)\[(.*)]$/ regex; a linear
		// endsWith/lastIndexOf parse must keep this fast and treat it as a plain
		// (non-array) field because there is no closing bracket.
		const handler = middy((event, context) => {
			return event.body;
		});

		// Raise the field-name cap so the bracket-heavy name reaches the array-field
		// parse branch (rather than being rejected by the size guard), exercising the
		// linear lastIndexOf/endsWith path against the previously catastrophic input.
		handler.use(
			httpMultipartBodyParser({ busboy: { limits: { fieldNameSize: 5000 } } }),
		);

		const evilName = "x".repeat(1000) + "[".repeat(1000);
		const event = {
			headers: {
				"content-type": "multipart/form-data; boundary=TEST",
			},
			body: `--TEST\r\nContent-Disposition: form-data; name="${evilName}"\r\n\r\nbar\r\n--TEST--`,
			isBase64Encoded: false,
		};

		const start = process.hrtime.bigint();
		const response = await handler(event, defaultContext);
		const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

		// No closing ']' -> stored as a plain field key with its raw value.
		strictEqual(response[evilName], "bar");
		// The buggy regex took multiple seconds for this input; linear parse is
		// sub-millisecond. Allow generous headroom for CI noise.
		ok(
			elapsedMs < 1000,
			`expected linear-time parse, took ${elapsedMs.toFixed(0)}ms`,
		);
	});

	test("It should normalize a synchronous BusBoy constructor throw to a 422 when disableContentTypeCheck is true", async (t) => {
		// With disableContentTypeCheck the mimePattern guard is skipped, so a
		// non-multipart content-type reaches BusBoy whose constructor throws
		// synchronously. That throw must be normalized to a 422, not leak raw.
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser({ disableContentTypeCheck: true }));

		const event = {
			headers: {
				"content-type": "application/json",
			},
			body: "not multipart",
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 422);
			strictEqual(
				e.cause.data.reason,
				"Invalid or malformed multipart/form-data was provided",
			);
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			// The construction error must be captured and rejected from the catch
			// block (not swallowed, which would later throw on an undefined busboy).
			strictEqual(e.cause.data.message, "Unsupported Content-Type.");
		}
	});

	test("It should normalize a synchronous BusBoy constructor throw to a 422 when content-type is missing and disableContentTypeCheck is true", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser({ disableContentTypeCheck: true }));

		const event = {
			headers: {},
			body: "not multipart",
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 422);
			strictEqual(
				e.cause.data.reason,
				"Invalid or malformed multipart/form-data was provided",
			);
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
		}
	});

	test("It should parse an array from a multipart/form-data request (base64)", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser({ charset: "base64" }));

		const event = {
			headers: {
				"Content-Type":
					"multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M",
			},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb29bXSINCg0Kb25lDQotLS0tLS1XZWJLaXRGb3JtQm91bmRhcnlwcHNRRXdmMkJWSmVDZTBNDQpDb250ZW50LURpc3Bvc2l0aW9uOiBmb3JtLWRhdGE7IG5hbWU9ImZvb1tdIg0KDQp0d28NCi0tLS0tLVdlYktpdEZvcm1Cb3VuZGFyeXBwc1FFd2YyQlZKZUNlME0tLQ==",
			isBase64Encoded: true,
		};
		const response = await handler(event, defaultContext);

		notStrictEqual(response.foo, undefined);
		strictEqual(response.foo.length, 2);
	});

	test("It should parse an array from a multipart/form-data request with ASCII dash (utf8)", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser({ charset: "utf8" }));

		const event = {
			headers: {
				"Content-Type": "multipart/form-data; boundary=TEST",
			},
			body: '--TEST\r\nContent-Disposition: form-data; name=PartName\r\nContent-Type: application/json; charset=utf-8\r\n\r\n{"foo":"bar-"}\r\n--TEST--',
			isBase64Encoded: false,
		};
		const response = await handler(event, defaultContext);

		deepStrictEqual(
			response,
			Object.assign(Object.create(null), { PartName: '{"foo":"bar-"}' }),
		);
	});

	test("It should parse an array from a multipart/form-data request (binary)", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser({ charset: "binary" }));

		const event = {
			headers: {
				"content-type": "multipart/form-data; boundary=TEST",
			},
			body: '--TEST\r\nContent-Disposition: form-data; name="file"; filename="file.bat"\r\nContent-Type: application/octet-stream\r\nContent-Transfer-Encoding: binary\r\n\r\n\r\n--TEST--',
			isBase64Encoded: false,
		};
		const response = await handler(event);

		deepStrictEqual(
			response,
			Object.assign(Object.create(null), {
				file: {
					content: Buffer.from(""),
					encoding: "binary",
					filename: "file.bat",
					mimetype: "application/octet-stream",
					truncated: false,
				},
			}),
		);
	});

	test("It should parse an array from a multipart/form-data request en dash (utf8)", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"Content-Type": "multipart/form-data; boundary=TEST",
			},
			body: '--TEST\r\nContent-Disposition: form-data; name=PartName\r\nContent-Type: application/json; charset=utf-8\r\n\r\n{"foo":"bar–"}\r\n--TEST--',
			isBase64Encoded: false,
		};
		const response = await handler(event, defaultContext);

		deepStrictEqual(
			response,
			Object.assign(Object.create(null), { PartName: '{"foo":"bar–"}' }),
		);
	});

	test("It should parse a field with multiple files successfully", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"Content-Type":
					"multipart/form-data; boundary=---------------------------237588144631607450464127370583",
			},
			body: "LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0yMzc1ODgxNDQ2MzE2MDc0NTA0NjQxMjczNzA1ODMNCkNvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT0iZmlsZXMiOyBmaWxlbmFtZT0idDIudHh0Ig0KQ29udGVudC1UeXBlOiB0ZXh0L3BsYWluDQoNCg0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0yMzc1ODgxNDQ2MzE2MDc0NTA0NjQxMjczNzA1ODMNCkNvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT0iZmlsZXMiOyBmaWxlbmFtZT0idDEudHh0Ig0KQ29udGVudC1UeXBlOiB0ZXh0L3BsYWluDQoNCg0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0yMzc1ODgxNDQ2MzE2MDc0NTA0NjQxMjczNzA1ODMNCkNvbnRlbnQtRGlzcG9zaXRpb246IGZvcm0tZGF0YTsgbmFtZT0iZmlsZXMiOyBmaWxlbmFtZT0idDMudHh0Ig0KQ29udGVudC1UeXBlOiB0ZXh0L3BsYWluDQoNCg0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0yMzc1ODgxNDQ2MzE2MDc0NTA0NjQxMjczNzA1ODMtLQ0K",
			isBase64Encoded: true,
		};
		const response = await handler(event, defaultContext);
		ok(Object.keys(response).includes("files"));
		strictEqual(response.files.length, 3);
	});

	// Security: Prototype pollution via __proto__ fieldname
	test("It should not pollute prototype with __proto__ fieldname", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"Content-Type": "multipart/form-data; boundary=TEST",
			},
			body: '--TEST\r\nContent-Disposition: form-data; name="__proto__"\r\n\r\npolluted\r\n--TEST--',
			isBase64Encoded: false,
		};
		const response = await handler(event, defaultContext);

		// Should store the value on the null-prototype object without polluting Object.prototype
		strictEqual(response.__proto__, "polluted");
		strictEqual({}.polluted, undefined);
		strictEqual(Object.getPrototypeOf(response), null);
	});

	test("It should not pollute prototype with constructor fieldname", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"Content-Type": "multipart/form-data; boundary=TEST",
			},
			body: '--TEST\r\nContent-Disposition: form-data; name="constructor"\r\n\r\npolluted\r\n--TEST--',
			isBase64Encoded: false,
		};
		const response = await handler(event, defaultContext);

		// Should store the value without shadowing Object.prototype.constructor on other objects
		strictEqual(response.constructor, "polluted");
		strictEqual({}.constructor, Object);
	});

	test("It should parse form data when the charset is in the header", async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		handler.use(httpMultipartBodyParser());

		// invokes the handler
		// Base64 encoded form data with field 'foo' of value 'bar'
		const event = {
			headers: {
				"content-type":
					"multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M; charset=UTF-8",
			},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t",
			isBase64Encoded: true,
		};
		const response = await handler(event, defaultContext);

		deepStrictEqual(
			response,
			Object.assign(Object.create(null), { foo: "bar" }),
		);
	});

	test("httpMultipartBodyParserValidateOptions accepts valid options and rejects typos", () => {
		httpMultipartBodyParserValidateOptions({
			busboy: {},
			charset: "utf8",
			disableContentTypeCheck: true,
		});
		httpMultipartBodyParserValidateOptions({});
		try {
			httpMultipartBodyParserValidateOptions({ bussboy: {} });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
		}
	});

	test("It should throw at construction for a charset Buffer does not know", async (t) => {
		let thrown;
		try {
			httpMultipartBodyParser({ charset: "utf-9" });
		} catch (e) {
			thrown = e;
		}
		ok(thrown instanceof TypeError, "expected an unknown charset to throw");
		strictEqual(
			thrown.message,
			"@middy/http-multipart-body-parser charset must be a Buffer encoding",
		);
		deepStrictEqual(thrown.cause, {
			package: "@middy/http-multipart-body-parser",
			data: { charset: "utf-9" },
		});
	});

	test("httpMultipartBodyParserValidateOptions rejects wrong type", () => {
		try {
			httpMultipartBodyParserValidateOptions({ charset: 42 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("charset"));
		}
	});

	test("httpMultipartBodyParserValidateOptions accepts known busboy keys", () => {
		httpMultipartBodyParserValidateOptions({
			busboy: {
				headers: { "content-type": "multipart/form-data" },
				highWaterMark: 16384,
				fileHwm: 16384,
				defCharset: "utf8",
				defParamCharset: "latin1",
				preservePath: false,
				isPartAFile: () => true,
				limits: {
					fieldNameSize: 100,
					fieldSize: 1024,
					fields: 10,
					fileSize: 1024,
					files: 5,
					parts: 20,
					headerPairs: 50,
				},
			},
		});
	});

	test("httpMultipartBodyParserValidateOptions allows unknown busboy keys (version drift)", () => {
		httpMultipartBodyParserValidateOptions({
			busboy: { futureOption: "value" },
		});
	});

	test("It should reject a content-type with leading garbage before multipart/form-data", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"content-type":
					"x-multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M",
			},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t",
			isBase64Encoded: true,
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
		}
	});

	test("It should reject a content-type with trailing garbage after the boundary", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"content-type":
					"multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M; junk",
			},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t",
			isBase64Encoded: true,
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
		}
	});

	test("It should accept a content-type with charset and no space after the semicolon", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"content-type":
					"multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M;charset=utf-8",
			},
			body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t",
			isBase64Encoded: true,
		};

		const response = await handler(event, defaultContext);
		deepStrictEqual(
			response,
			Object.assign(Object.create(null), { foo: "bar" }),
		);
	});

	test("httpMultipartBodyParserValidateOptions allows unknown busboy.limits keys", () => {
		httpMultipartBodyParserValidateOptions({
			busboy: { limits: { futureLimit: 5 } },
		});
	});

	test("httpMultipartBodyParserValidateOptions rejects non-boolean disableContentTypeError", () => {
		try {
			httpMultipartBodyParserValidateOptions({
				disableContentTypeError: "notabool",
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(
				e.message,
				"Option 'disableContentTypeError' must be boolean",
			);
		}
	});

	test("It should decode a non-base64 body using the default utf8 charset", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"content-type": "multipart/form-data; boundary=TEST",
			},
			body: '--TEST\r\nContent-Disposition: form-data; name="foo"\r\n\r\nbär\r\n--TEST--',
			isBase64Encoded: false,
		};

		const response = await handler(event, defaultContext);
		strictEqual(response.foo, "bär");
	});

	test("It should throw 415 on an unsupported content-type when disableContentTypeError is left at its default", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"content-type": "application/json",
			},
			body: "irrelevant",
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
			strictEqual(e.cause.data.contentType, "application/json");
		}
	});

	test("It should not throw a TypeError when event has no headers (handled as 415)", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			body: "irrelevant",
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 415);
			strictEqual(e.message, "Unsupported Media Type");
			strictEqual(e.cause.data.contentType, undefined);
		}
	});

	test("It should throw 422 when content-type is valid but body is undefined", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"content-type": "multipart/form-data; boundary=TEST",
			},
			body: undefined,
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 422);
			strictEqual(
				e.cause.data.reason,
				"Invalid or malformed multipart/form-data was provided",
			);
			strictEqual(e.cause.data.body, undefined);
			// The dedicated missing-body guard throws before busboy is touched, so
			// no downstream stream error message is attached. If the guard were
			// skipped, busboy.write(undefined) would throw and populate cause.message.
			strictEqual(e.cause.data.message, undefined);
		}
	});

	test("It should not throw a TypeError during busboy construction when headers are absent and content-type check is disabled", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser({ disableContentTypeCheck: true }));

		const event = {
			body: "not multipart",
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 422);
			strictEqual(
				e.cause.data.reason,
				"Invalid or malformed multipart/form-data was provided",
			);
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			// Null-safe header access means busboy receives an undefined
			// content-type and reports a missing-header error, rather than the
			// middleware throwing a raw TypeError on event.headers["..."].
			strictEqual(e.cause.data.message, "Missing Content-Type-header.");
		}
	});

	test("It should accumulate uploaded file content bytes", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"content-type": "multipart/form-data; boundary=TEST",
			},
			body: '--TEST\r\nContent-Disposition: form-data; name="file"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhello world!\r\n--TEST--',
			isBase64Encoded: false,
		};

		const response = await handler(event, defaultContext);
		strictEqual(response.file.content.toString(), "hello world!");
		ok(response.file.content.length > 0);
	});

	test("It should reject with a 413 when a file part exceeds the configured fileSize limit instead of silently truncating", async (t) => {
		const handler = middy((event) => event.body);

		handler.use(
			httpMultipartBodyParser({ busboy: { limits: { fileSize: 4 } } }),
		);

		// "hello world!" is 12 bytes, well over the 4-byte fileSize limit. Busboy
		// truncates the stream and sets file.truncated; the middleware must fail
		// loudly with a 413 rather than return a clipped 4-byte buffer.
		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="file"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhello world!\r\n--TEST--',
			isBase64Encoded: false,
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 413);
			strictEqual(e.message, "Payload Too Large");
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			// With several parts in a form, the filename is the only thing telling
			// the caller which one blew the limit.
			strictEqual(e.cause.data.filename, "f.txt");
		}
	});

	test("It should parse a small file part that stays within the configured fileSize limit", async (t) => {
		const handler = middy((event) => event.body);

		handler.use(
			httpMultipartBodyParser({ busboy: { limits: { fileSize: 1000 } } }),
		);

		// "hello" is 5 bytes, under the 1000-byte limit; parsing is unchanged and
		// the file is not truncated.
		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="file"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--TEST--',
			isBase64Encoded: false,
		};

		const response = await handler(event, defaultContext);
		strictEqual(response.file.content.toString(), "hello");
		strictEqual(response.file.truncated, false);
	});

	test("It should reject a file field name exceeding the cap and pass at the boundary", async (t) => {
		const overHandler = middy((event) => event.body);
		overHandler.use(
			httpMultipartBodyParser({ busboy: { limits: { fieldNameSize: 5 } } }),
		);

		// "attach" is length 6, one over the cap of 5
		const overEvent = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="attach"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--TEST--',
			isBase64Encoded: false,
		};

		try {
			await overHandler(overEvent, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 413);
			deepStrictEqual(e.cause.data, { limit: "fieldNameSize" });
		}

		const atHandler = middy((event) => event.body);
		atHandler.use(
			httpMultipartBodyParser({ busboy: { limits: { fieldNameSize: 5 } } }),
		);

		// "files" is length 5, exactly at the cap; must pass
		const atEvent = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="files"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--TEST--',
			isBase64Encoded: false,
		};

		const atResponse = await atHandler(atEvent, defaultContext);
		notStrictEqual(atResponse.files, undefined);
		strictEqual(atResponse.files.content.toString(), "hello");
	});

	test("It should reject a non-file field name exceeding the cap and pass at the boundary with the expected message", async (t) => {
		const overHandler = middy((event) => event.body);
		overHandler.use(
			httpMultipartBodyParser({ busboy: { limits: { fieldNameSize: 5 } } }),
		);

		// "field6" is length 6, one over the cap of 5
		const overEvent = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="field6"\r\n\r\nval\r\n--TEST--',
			isBase64Encoded: false,
		};

		try {
			await overHandler(overEvent, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 413);
			deepStrictEqual(e.cause.data, { limit: "fieldNameSize" });
		}

		const atHandler = middy((event) => event.body);
		atHandler.use(
			httpMultipartBodyParser({ busboy: { limits: { fieldNameSize: 5 } } }),
		);

		// "field" is length 5, exactly at the cap; must pass
		const atEvent = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="field"\r\n\r\nval\r\n--TEST--',
			isBase64Encoded: false,
		};

		const atResponse = await atHandler(atEvent, defaultContext);
		strictEqual(atResponse.field, "val");
	});

	test("It should group a field name with '[' at index 1 as an array under the leading key", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: {
				"content-type": "multipart/form-data; boundary=TEST",
			},
			body: '--TEST\r\nContent-Disposition: form-data; name="a[b]"\r\n\r\nval\r\n--TEST--',
			isBase64Encoded: false,
		};

		const response = await handler(event, defaultContext);
		deepStrictEqual(response.a, ["val"]);
	});

	test("It should reject a malformed/corrupt multipart body with a 422 via the busboy error handler", async (t) => {
		const handler = middy((event, context) => {
			return event.body;
		});

		handler.use(httpMultipartBodyParser());

		// Declares two parts but the stream ends mid-part, triggering a busboy
		// stream "error" event rather than a clean "finish".
		const event = {
			headers: {
				"content-type": "multipart/form-data; boundary=TEST",
			},
			body: '--TEST\r\nContent-Disposition: form-data; name="foo"\r\n\r\nbar',
			isBase64Encoded: false,
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 422);
			strictEqual(
				e.cause.data.reason,
				"Invalid or malformed multipart/form-data was provided",
			);
		}
	});

	test("httpMultipartBodyParserValidateOptions rejects bad busboy field types", () => {
		try {
			httpMultipartBodyParserValidateOptions({
				busboy: { highWaterMark: "big" },
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
		}
		try {
			httpMultipartBodyParserValidateOptions({
				busboy: { limits: { fileSize: -1 } },
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
		}
		try {
			httpMultipartBodyParserValidateOptions({
				busboy: { isPartAFile: "nope" },
			});
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
		}
	});

	// Busboy's `field` and `file` callbacks run from stream events on a later
	// tick. A throw inside one of them used to escape as an uncaughtException and
	// leave the parse promise pending forever, so the request never answered.
	const withUncaughtGuard = async (fn) => {
		const escaped = [];
		const onUncaught = (e) => escaped.push(e);
		process.on("uncaughtException", onUncaught);
		let timer;
		try {
			const settled = await Promise.race([
				fn().then(
					(value) => ({ value }),
					(error) => ({ error }),
				),
				new Promise((resolve) => {
					timer = setTimeout(() => resolve("pending"), 200);
				}),
			]);
			return { settled, escaped };
		} finally {
			clearTimeout(timer);
			process.off("uncaughtException", onUncaught);
		}
	};

	test("It should fold a scalar field into an array when a bracketed field of the same name follows", async (t) => {
		const handler = middy((event) => event.body);

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n--TEST\r\nContent-Disposition: form-data; name="a[]"\r\n\r\n2\r\n--TEST--',
			isBase64Encoded: false,
		};

		const { settled, escaped } = await withUncaughtGuard(() =>
			handler(event, defaultContext),
		);

		deepStrictEqual(escaped, []);
		deepStrictEqual(settled, {
			value: Object.assign(Object.create(null), { a: ["1", "2"] }),
		});
	});

	test("It should append every bracketed field of the same name to one flat array", async () => {
		const handler = middy((event) => event.body);

		handler.use(httpMultipartBodyParser());

		const part = (value) =>
			`--TEST\r\nContent-Disposition: form-data; name="a[]"\r\n\r\n${value}\r\n`;
		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: `${part("1")}${part("2")}${part("3")}--TEST--`,
			isBase64Encoded: false,
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(
			response,
			Object.assign(Object.create(null), { a: ["1", "2", "3"] }),
		);
	});

	test("It should reject with a 422 when a handler throws inside busboy's callback instead of escaping as an uncaughtException", async (t) => {
		const handler = middy((event) => event.body);

		handler.use(httpMultipartBodyParser());

		// The file `end` handler runs on a later tick than `busboy.write()`, so a
		// throw there cannot be caught by the promise executor. Fault-inject the
		// one call it makes.
		t.mock.method(Buffer, "concat", () => {
			throw new Error("boom");
		});

		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="file"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--TEST--',
			isBase64Encoded: false,
		};

		const { settled, escaped } = await withUncaughtGuard(() =>
			handler(event, defaultContext),
		);

		deepStrictEqual(escaped, []);
		notStrictEqual(settled, "pending");
		strictEqual(settled.error.statusCode, 422);
		strictEqual(
			settled.error.cause.package,
			"@middy/http-multipart-body-parser",
		);
		strictEqual(settled.error.cause.data.message, "boom");
	});

	test("It should reject with a 413 when a field value exceeds the configured fieldSize limit instead of silently truncating", async (t) => {
		const handler = middy((event) => event.body);

		handler.use(
			httpMultipartBodyParser({ busboy: { limits: { fieldSize: 4 } } }),
		);

		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="a"\r\n\r\n0123456789\r\n--TEST--',
			isBase64Encoded: false,
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 413);
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			strictEqual(e.cause.data.fieldname, "a");
		}
	});

	test("It should reject with a 413 when the number of fields exceeds the configured fields limit instead of silently dropping", async (t) => {
		const handler = middy((event) => event.body);

		handler.use(httpMultipartBodyParser({ busboy: { limits: { fields: 1 } } }));

		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n--TEST\r\nContent-Disposition: form-data; name="b"\r\n\r\n2\r\n--TEST--',
			isBase64Encoded: false,
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 413);
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			strictEqual(e.cause.data.limit, "fields");
		}
	});

	test("It should reject with a 413 when the number of files exceeds the configured files limit instead of silently dropping", async (t) => {
		const handler = middy((event) => event.body);

		handler.use(httpMultipartBodyParser({ busboy: { limits: { files: 0 } } }));

		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="file"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--TEST--',
			isBase64Encoded: false,
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 413);
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			strictEqual(e.cause.data.limit, "files");
		}
	});

	test("It should reject with a 413 when the number of parts exceeds the configured parts limit instead of silently dropping", async (t) => {
		const handler = middy((event) => event.body);

		handler.use(httpMultipartBodyParser({ busboy: { limits: { parts: 1 } } }));

		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n--TEST\r\nContent-Disposition: form-data; name="b"\r\n\r\n2\r\n--TEST--',
			isBase64Encoded: false,
		};

		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 413);
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
			strictEqual(e.cause.data.limit, "parts");
		}
	});

	// A body that ends inside a file part (no closing boundary after the file)
	// rejects with a 422, and busboy then emits `error` on the part stream on a
	// later tick. Without a listener that second emit is an uncaughtException.
	test("It should reject with a 422 when the body ends inside a file part instead of crashing the process", async (t) => {
		const handler = middy((event) => event.body);

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="file"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhello',
			isBase64Encoded: false,
		};

		const { settled, escaped } = await withUncaughtGuard(() =>
			handler(event, defaultContext),
		);

		deepStrictEqual(escaped, []);
		notStrictEqual(settled, "pending");
		strictEqual(settled.error.statusCode, 422);
		strictEqual(
			settled.error.cause.package,
			"@middy/http-multipart-body-parser",
		);
	});

	test("It should push a scalar field into an existing array when a bracketed field of the same name precedes it", async (t) => {
		const handler = middy((event) => event.body);

		handler.use(httpMultipartBodyParser());

		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="a[]"\r\n\r\n1\r\n--TEST\r\nContent-Disposition: form-data; name="a"\r\n\r\n2\r\n--TEST--',
			isBase64Encoded: false,
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(
			response,
			Object.assign(Object.create(null), { a: ["1", "2"] }),
		);
	});

	test("It should keep folding in both directions across a mixed scalar and bracketed sequence", async (t) => {
		const handler = middy((event) => event.body);

		handler.use(httpMultipartBodyParser());

		const part = (name, value) =>
			`--TEST\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: `${part("a", "1")}${part("a[]", "2")}${part("a", "3")}--TEST--`,
			isBase64Encoded: false,
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(
			response,
			Object.assign(Object.create(null), { a: ["1", "2", "3"] }),
		);
	});

	// busboy hands a part whose Content-Disposition carries no `name` to the
	// `field` and `file` listeners with `fieldname === undefined`. The length guard
	// then threw a TypeError that surfaced as a 422 with a message about reading
	// `length` of undefined, which said nothing about the form.
	test("It should reject a field part with no name with a 422 that says so", async (t) => {
		const handler = middy((event) => event.body);
		handler.use(httpMultipartBodyParser());
		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: "--TEST\r\nContent-Disposition: form-data\r\n\r\nval\r\n--TEST--",
			isBase64Encoded: false,
		};
		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 422);
			strictEqual(e.message, "Unprocessable Entity");
			deepStrictEqual(e.cause.data, {
				reason: "Multipart part is missing a field name",
			});
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
		}
	});

	test("It should reject a file part with no name with a 422 that says so", async (t) => {
		const handler = middy((event) => event.body);
		handler.use(httpMultipartBodyParser());
		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--TEST--',
			isBase64Encoded: false,
		};
		try {
			await handler(event, defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 422);
			deepStrictEqual(e.cause.data, {
				reason: "Multipart part is missing a field name",
			});
			strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
		}
	});

	// A file part rejected for its field name still gets busboy's later `error`
	// emit when the body ends inside it. The part stream's error listener used to
	// be attached only after the field-name guard, so that second emit escaped as
	// an uncaughtException on top of the 422 already sent.
	test("It should reject a nameless file part whose body ends early without crashing the process", async (t) => {
		const handler = middy((event) => event.body);
		handler.use(httpMultipartBodyParser());
		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhel',
			isBase64Encoded: false,
		};

		const { settled, escaped } = await withUncaughtGuard(() =>
			handler(event, defaultContext),
		);

		deepStrictEqual(escaped, []);
		notStrictEqual(settled, "pending");
		strictEqual(settled.error.statusCode, 422);
		deepStrictEqual(settled.error.cause.data, {
			reason: "Multipart part is missing a field name",
		});
	});

	test("It should reject an over-long file field name whose body ends early without crashing the process", async (t) => {
		const handler = middy((event) => event.body);
		handler.use(
			httpMultipartBodyParser({ busboy: { limits: { fieldNameSize: 5 } } }),
		);
		const event = {
			headers: { "content-type": "multipart/form-data; boundary=TEST" },
			body: '--TEST\r\nContent-Disposition: form-data; name="attachment"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhel',
			isBase64Encoded: false,
		};

		const { settled, escaped } = await withUncaughtGuard(() =>
			handler(event, defaultContext),
		);

		deepStrictEqual(escaped, []);
		notStrictEqual(settled, "pending");
		strictEqual(settled.error.statusCode, 413);
		deepStrictEqual(settled.error.cause.data, { limit: "fieldNameSize" });
	});
});
