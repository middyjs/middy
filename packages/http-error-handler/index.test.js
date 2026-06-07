import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import { createError } from "../util/index.js";
import httpErrorHandler, { httpErrorHandlerValidateOptions } from "./index.js";

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should create a response for HTTP errors (string)", async (t) => {
	const handler = middy(() => {
		throw createError(422, "Unprocessable Entity");
	});

	handler.use(httpErrorHandler({ logger: false }));

	const response = await handler(null, defaultContext);

	deepStrictEqual(response, {
		statusCode: 422,
		body: "Unprocessable Entity",
		headers: {
			"Content-Type": "text/plain",
		},
	});
});

test("It should create a response for HTTP errors (json)", async (t) => {
	const handler = middy(() => {
		throw new Error();
	});

	handler.use(
		httpErrorHandler({ logger: false, fallbackMessage: '{ "json": "error" }' }),
	);

	const response = await handler(defaultEvent, defaultContext);

	deepStrictEqual(response, {
		statusCode: 500,
		body: '{ "json": "error" }',
		headers: {
			"Content-Type": "application/json",
		},
	});
});

test("It should handle non HTTP errors when fallback not set", async (t) => {
	const handler = middy(() => {
		throw new Error("non-http error");
	});

	handler.use(httpErrorHandler({ logger: false }));

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(response, {
		statusCode: 500,
		headers: {},
	});
});

test("It should handle non HTTP errors when fallback set", async (t) => {
	const handler = middy(() => {
		throw new Error("non-http error");
	});

	handler.use(
		httpErrorHandler({ logger: false, fallbackMessage: "Error: unknown" }),
	);

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(response, {
		statusCode: 500,
		body: "Error: unknown",
		headers: {
			"Content-Type": "text/plain",
		},
	});
});

test("It should be possible to pass a custom logger function", async (t) => {
	const expectedError = createError(422);
	const logger = t.mock.fn();

	const handler = middy(() => {
		throw expectedError;
	});

	handler.use(httpErrorHandler({ logger }));

	await handler(defaultEvent, defaultContext);

	deepStrictEqual(logger.mock.calls[0].arguments, [expectedError]);
});

test("It should be possible to pass in headers with error", async (t) => {
	const handler = middy(() => {
		const error = createError(422, "Unprocessable Entity");
		error.headers = {
			Location: "https://example.org/500",
		};
		throw error;
	});

	handler.use(httpErrorHandler({ logger: false }));

	const response = await handler(null, defaultContext);

	deepStrictEqual(response, {
		statusCode: 422,
		body: "Unprocessable Entity",
		headers: {
			"Content-Type": "text/plain",
			Location: "https://example.org/500",
		},
	});
});

test("It should create a response for HTTP errors created with a generic error", async (t) => {
	const handler = middy(() => {
		const err = new Error("A server error");
		err.statusCode = 412;
		throw err;
	});

	handler.use(httpErrorHandler({ logger: false }));

	const response = await handler(defaultEvent, defaultContext);

	deepStrictEqual(response, {
		statusCode: 412,
		body: "A server error",
		headers: {
			"Content-Type": "text/plain",
		},
	});
});

test("It should expose of error to user", async (t) => {
	const expectedError = createError(404, "NotFound");

	const handler = middy(() => {
		throw expectedError;
	});

	handler.use(
		httpErrorHandler({ logger: false, fallbackMessage: "Error: unknown" }),
	);

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(response, {
		statusCode: 404,
		body: "NotFound",
		headers: {
			"Content-Type": "text/plain",
		},
	});
});

test("It should be possible to prevent expose of error to user", async (t) => {
	const expectedError = createError(404, "NotFound", { expose: false });

	const handler = middy(() => {
		throw expectedError;
	});

	handler.use(
		httpErrorHandler({ logger: false, fallbackMessage: "Error: unknown" }),
	);

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(response, {
		statusCode: 500,
		body: "Error: unknown",
		headers: {
			"Content-Type": "text/plain",
		},
	});
});

test("It should not send error to user", async (t) => {
	const expectedError = createError(500, "InternalError");

	const handler = middy(() => {
		throw expectedError;
	});

	handler.use(
		httpErrorHandler({ logger: false, fallbackMessage: "Error: unknown" }),
	);

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(response, {
		statusCode: 500,
		body: "Error: unknown",
		headers: {
			"Content-Type": "text/plain",
		},
	});
});

test("It should be possible to force expose of error to user", async (t) => {
	const expectedError = createError(500, "OkayError", { expose: true });

	const handler = middy(() => {
		throw expectedError;
	});

	handler.use(
		httpErrorHandler({ logger: false, fallbackMessage: "Error: unknown" }),
	);

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(response, {
		statusCode: 500,
		body: "OkayError",
		headers: {
			"Content-Type": "text/plain",
		},
	});
});

test("It should allow later middleware to modify the response", async (t) => {
	const handler = middy(() => {
		throw createError(422, "Unprocessable Entity");
	});

	handler
		.onError((request) => {
			request.response.headers["X-DNS-Prefetch-Control"] = "off";
		})
		.use(httpErrorHandler({ logger: false }));

	const response = await handler(null, defaultContext);

	deepStrictEqual(response, {
		statusCode: 422,
		body: "Unprocessable Entity",
		headers: {
			"Content-Type": "text/plain",
			"X-DNS-Prefetch-Control": "off",
		},
	});
});

test("It should not handle error is response is set", async (t) => {
	const handler = middy(() => {
		throw createError(422);
	});

	handler.use(httpErrorHandler({ logger: false })).onError((request) => {
		request.response = true;
	});

	const response = await handler(null, defaultContext);

	ok(response);
});

test("It should return the 500 fallback when a non-object is thrown", async (t) => {
	const handler = middy(() => {
		throw null;
	});

	handler.use(httpErrorHandler({ logger: false }));

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(response, {
		statusCode: 500,
		headers: {},
	});
});

test("It should return the 500 fallback when a primitive is thrown", async (t) => {
	const handler = middy(() => {
		throw "boom";
	});

	handler.use(httpErrorHandler({ logger: false }));

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(response, {
		statusCode: 500,
		headers: {},
	});
});

test("It should keep an error-supplied Content-Type header", async (t) => {
	const handler = middy(() => {
		const error = createError(422, "<error>Unprocessable</error>");
		error.headers = {
			"Content-Type": "application/xml",
		};
		throw error;
	});

	handler.use(httpErrorHandler({ logger: false }));

	const response = await handler(null, defaultContext);

	deepStrictEqual(response, {
		statusCode: 422,
		body: "<error>Unprocessable</error>",
		headers: {
			"Content-Type": "application/xml",
		},
	});
});

test("It should use the default console.error logger when none is provided", async (t) => {
	const write = t.mock.method(process.stderr, "write", () => true);

	const handler = middy(() => {
		throw createError(422, "Unprocessable Entity");
	});

	handler.use(httpErrorHandler());

	const response = await handler(defaultEvent, defaultContext);

	ok(write.mock.calls.length >= 1);
	deepStrictEqual(response, {
		statusCode: 422,
		body: "Unprocessable Entity",
		headers: {
			"Content-Type": "text/plain",
		},
	});
});

test("It should leave an already-set response untouched", async (t) => {
	const handler = middy(() => {
		throw createError(422, "Unprocessable Entity");
	});

	handler.use(httpErrorHandler({ logger: false })).onError((request) => {
		request.response = "already-handled";
	});

	const response = await handler(defaultEvent, defaultContext);

	strictEqual(response, "already-handled");
});

test("It should fall back to 500 for a non-object error carrying http properties", async (t) => {
	const errorFn = () => {};
	errorFn.statusCode = 422;
	errorFn.expose = true;
	errorFn.message = "should be ignored";

	const handler = middy(() => {
		throw errorFn;
	});

	handler.use(httpErrorHandler({ logger: false }));

	const response = await handler(defaultEvent, defaultContext);

	deepStrictEqual(response, {
		statusCode: 500,
		headers: {},
	});
});

test("It should not expose a generic 500 error (statusCode === 500 boundary)", async (t) => {
	const handler = middy(() => {
		const err = new Error("A server error");
		err.statusCode = 500;
		throw err;
	});

	handler.use(httpErrorHandler({ logger: false }));

	const response = await handler(defaultEvent, defaultContext);

	deepStrictEqual(response, {
		statusCode: 500,
		headers: {},
	});
});

test("httpErrorHandlerValidateOptions accepts valid options and rejects typos", () => {
	httpErrorHandlerValidateOptions({ logger: () => {}, fallbackMessage: "x" });
	httpErrorHandlerValidateOptions({ logger: false });
	httpErrorHandlerValidateOptions({});
	try {
		httpErrorHandlerValidateOptions({ fallbckMessage: "x" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-error-handler");
	}
});

test("httpErrorHandlerValidateOptions rejects wrong type", () => {
	try {
		httpErrorHandlerValidateOptions({ fallbackMessage: 42 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("fallbackMessage"));
	}
});
