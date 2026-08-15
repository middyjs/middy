import {
	deepStrictEqual,
	notStrictEqual,
	ok,
	strictEqual,
} from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpMultipartBodyParser, {
	httpMultipartBodyParserValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

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

	deepStrictEqual(response, Object.assign(Object.create(null), { foo: "bar" }));
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
	deepStrictEqual(response, Object.assign(Object.create(null), { foo: "bar" }));
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
			e.message,
			"Invalid or malformed multipart/form-data was provided",
		);
		strictEqual(e.cause.data, undefined);
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
			e.message,
			"Invalid or malformed multipart/form-data was provided",
		);
		strictEqual(e.cause.message, "May not write null values to stream");
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
			e.message,
			"Invalid or malformed multipart/form-data was provided",
		);
		strictEqual(e.cause.message, "Unexpected end of multipart data");
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
		strictEqual(e.cause.data, undefined);
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
		strictEqual(e.cause.data, "application/json");
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
		strictEqual(e.cause.data, undefined);
	}
});

test("It should reject a field name larger than the default fieldNameSize cap", async (t) => {
	// @fastify/busboy does not enforce limits.fieldNameSize for multipart, so a
	// conservative default cap (100) is enforced by the middleware and an
	// over-cap field name is normalized to a 422.
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
		strictEqual(e.statusCode, 422);
		strictEqual(
			e.message,
			"Invalid or malformed multipart/form-data was provided",
		);
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
		strictEqual(e.statusCode, 422);
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
			e.message,
			"Invalid or malformed multipart/form-data was provided",
		);
		strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
		// The construction error must be captured and rejected from the catch
		// block (not swallowed, which would later throw on an undefined busboy).
		strictEqual(e.cause.message, "Unsupported Content-Type.");
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
			e.message,
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

	deepStrictEqual(response, Object.assign(Object.create(null), { foo: "bar" }));
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
	deepStrictEqual(response, Object.assign(Object.create(null), { foo: "bar" }));
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
		strictEqual(e.message, "Option 'disableContentTypeError' must be boolean");
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
		strictEqual(e.cause.data, "application/json");
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
		strictEqual(e.cause.data, undefined);
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
			e.message,
			"Invalid or malformed multipart/form-data was provided",
		);
		strictEqual(e.cause.data, undefined);
		// The dedicated missing-body guard throws before busboy is touched, so
		// no downstream stream error message is attached. If the guard were
		// skipped, busboy.write(undefined) would throw and populate cause.message.
		strictEqual(e.cause.message, undefined);
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
			e.message,
			"Invalid or malformed multipart/form-data was provided",
		);
		strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
		// Null-safe header access means busboy receives an undefined
		// content-type and reports a missing-header error, rather than the
		// middleware throwing a raw TypeError on event.headers["..."].
		strictEqual(e.cause.message, "Missing Content-Type-header.");
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

	handler.use(httpMultipartBodyParser({ busboy: { limits: { fileSize: 4 } } }));

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
		strictEqual(e.message, "Request Entity Too Large");
		strictEqual(e.cause.package, "@middy/http-multipart-body-parser");
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
		strictEqual(e.statusCode, 422);
		strictEqual(e.cause.message, "Field name size limit exceeded");
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
		strictEqual(e.statusCode, 422);
		strictEqual(e.cause.message, "Field name size limit exceeded");
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
			e.message,
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
