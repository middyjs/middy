import { deepEqual, doesNotThrow, equal } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpEventNormalizer from "./index.js";

// const event = {}
const context = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should not throw error when invalid version", async (t) => {
	const event = {
		version: "3.0",
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	doesNotThrow(async () => await handler(event, context));
});

test("It should not error if not an HTTP event", async (t) => {
	const event = {
		source: "s3",
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	doesNotThrow(async () => await handler(event, context));
});

test("It should default queryStringParameters with REST API", async (t) => {
	const event = {
		httpMethod: "GET",
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.queryStringParameters, {});
});

test("It should default queryStringParameters with HTTP API", async (t) => {
	const event = {
		version: "2.0",
		requestContext: {
			http: {
				method: "GET",
			},
		},
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.queryStringParameters, {});
});

test("It should default queryStringParameters with VPC Lattice", async (t) => {
	const event = {
		method: "GET",
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.queryStringParameters, {});
});

test("It should set queryStringParameters with VPC Lattice", async (t) => {
	const event = {
		method: "GET",
		query_string_parameters: {
			foo: "bar",
		},
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.queryStringParameters, { foo: "bar" });
});

test("It should set isBase64Encoded with VPC Lattice", async (t) => {
	const event = {
		method: "GET",
		is_base64_encoded: false,
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	equal(normalizedEvent.isBase64Encoded, false);
});

test("It should default multiValueQueryStringParameters", async (t) => {
	const event = {
		httpMethod: "GET",
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.multiValueQueryStringParameters, {});
});

test("It should default pathParameters with REST API", async (t) => {
	const event = {
		httpMethod: "GET",
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.pathParameters, {});
});

test("It should default pathParameters with HTTP API", async (t) => {
	const event = {
		version: "2.0",
		requestContext: {
			http: {
				method: "GET",
			},
		},
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.pathParameters, {});
});

test("It should not overwrite queryStringParameters", async (t) => {
	const event = {
		httpMethod: "GET",
		queryStringParameters: { param: "hello" },
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.queryStringParameters, { param: "hello" });
});

test("It should not overwrite queryStringParameters with HTTP API", async (t) => {
	const event = {
		version: "2.0",
		requestContext: {
			http: {
				method: "GET",
			},
		},
		queryStringParameters: { param: "hello" },
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.queryStringParameters, { param: "hello" });
});

test("It should not overwrite multiValueQueryStringParameters", async (t) => {
	const event = {
		httpMethod: "GET",
		multiValueQueryStringParameters: { param: ["hello"] },
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.multiValueQueryStringParameters, {
		param: ["hello"],
	});
});

test("It should not overwrite pathParameters", async (t) => {
	const event = {
		httpMethod: "GET",
		pathParameters: { param: "hello" },
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.pathParameters, { param: "hello" });
});

test("It should not overwrite pathParameters with HTTP API", async (t) => {
	const event = {
		version: "2.0",
		requestContext: {
			http: {
				method: "GET",
			},
		},
		pathParameters: { param: "hello" },
	};

	const handler = middy((event) => event).use(httpEventNormalizer());
	const normalizedEvent = await handler(event, context);

	deepEqual(normalizedEvent.pathParameters, { param: "hello" });
});
