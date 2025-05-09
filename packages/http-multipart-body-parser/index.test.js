import { deepEqual, equal, notEqual, ok } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpMultipartBodyParser from "./index.js";

// const event = {}
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

	deepEqual(response, { foo: "bar" });
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
	deepEqual(response, { foo: "bar" });
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

	notEqual(response.attachment, undefined);
	notEqual(response.attachment.content, undefined);
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
		equal(e.message, "Invalid or malformed multipart/form-data was provided");
		equal(e.cause.data, undefined);
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
		equal(e.message, "Invalid or malformed multipart/form-data was provided");
		equal(e.cause.message, "May not write null values to stream");
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
		equal(e.message, "Invalid or malformed multipart/form-data was provided");
		equal(e.cause.message, "Unexpected end of multipart data");
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
		equal(e.statusCode, 415);
		equal(e.message, "Unsupported Media Type");
		equal(e.cause.data, undefined);
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
		equal(e.statusCode, 415);
		equal(e.message, "Unsupported Media Type");
		equal(e.cause.data, "application/json");
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
	equal(
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
		equal(e.statusCode, 415);
		equal(e.message, "Unsupported Media Type");
		equal(e.cause.data, undefined);
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

	notEqual(response.foo, undefined);
	equal(response.foo.length, 2);
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

	deepEqual(response, { PartName: '{"foo":"bar-"}' });
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

	deepEqual(response, {
		file: {
			content: Buffer.from(""),
			encoding: "binary",
			filename: "file.bat",
			mimetype: "application/octet-stream",
			truncated: false,
		},
	});
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

	deepEqual(response, { PartName: '{"foo":"bar–"}' });
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
	equal(response.files.length, 3);
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

	deepEqual(response, { foo: "bar" });
});
