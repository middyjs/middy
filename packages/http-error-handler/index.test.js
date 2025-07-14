import { deepEqual, ok } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import { createError } from "../util/index.js";
import httpErrorHandler from "./index.js";

// Silence logging
// console.error = () => {}

const event = {};
const context = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should create a response for HTTP errors (string)", async (t) => {
	const handler = middy(() => {
		throw createError(422, "Unprocessable Entity");
	});

	handler.use(httpErrorHandler({ logger: false }));

	const response = await handler(null, context);

	deepEqual(response, {
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

	const response = await handler(event, context);

	deepEqual(response, {
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

	const response = await handler(event, context);
	deepEqual(response, {
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

	const response = await handler(event, context);
	deepEqual(response, {
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

	await handler(event, context);

	deepEqual(logger.mock.calls[0].arguments, [expectedError]);
});

test("It should be possible to pass in headers with error", async (t) => {
	const handler = middy(() => {
		const error = createError(422, "Unprocessable Entity");
		error.headers = {
			Location: "http://exmaple.org/500",
		};
		throw error;
	});

	handler.use(httpErrorHandler({ logger: false }));

	const response = await handler(null, context);

	deepEqual(response, {
		statusCode: 422,
		body: "Unprocessable Entity",
		headers: {
			"Content-Type": "text/plain",
			Location: "http://exmaple.org/500",
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

	const response = await handler(event, context);

	deepEqual(response, {
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

	const response = await handler(event, context);
	deepEqual(response, {
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

	const response = await handler(event, context);
	deepEqual(response, {
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

	const response = await handler(event, context);
	deepEqual(response, {
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

	const response = await handler(event, context);
	deepEqual(response, {
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

	const response = await handler(null, context);

	deepEqual(response, {
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

	const response = await handler(null, context);

	ok(response);
});
