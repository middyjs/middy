import {
	deepStrictEqual,
	doesNotThrow,
	ok,
	strictEqual,
} from "node:assert/strict";
import { describe, test } from "node:test";
import middy from "../core/index.js";
import httpEventNormalizer, {
	httpEventNormalizerValidateOptions,
} from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

describe("@middy/http-event-normalizer", () => {
	test("It should not throw error when invalid version", async (t) => {
		const event = {
			version: "3.0",
		};

		const handler = middy((event) => event).use(httpEventNormalizer());
		doesNotThrow(async () => await handler(event, defaultContext));
	});

	test("It should not error if not an HTTP event", async (t) => {
		const event = {
			source: "s3",
		};

		const handler = middy((event) => event).use(httpEventNormalizer());
		doesNotThrow(async () => await handler(event, defaultContext));
	});

	test("It should default queryStringParameters with REST API", async (t) => {
		const event = {
			httpMethod: "GET",
		};

		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.queryStringParameters, {});
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
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.queryStringParameters, {});
	});

	test("It should default queryStringParameters with VPC Lattice", async (t) => {
		const event = {
			method: "GET",
		};

		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.queryStringParameters, {});
	});

	test("It should set queryStringParameters with VPC Lattice", async (t) => {
		const event = {
			method: "GET",
			query_string_parameters: {
				foo: "bar",
			},
		};

		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.queryStringParameters, { foo: "bar" });
	});

	test("It should set isBase64Encoded with VPC Lattice", async (t) => {
		const event = {
			method: "GET",
			is_base64_encoded: false,
		};

		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(event, defaultContext);

		strictEqual(normalizedEvent.isBase64Encoded, false);
	});

	test("It should default multiValueQueryStringParameters", async (t) => {
		const event = {
			httpMethod: "GET",
		};

		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.multiValueQueryStringParameters, {});
	});

	test("It should default pathParameters with REST API", async (t) => {
		const event = {
			httpMethod: "GET",
		};

		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.pathParameters, {});
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
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.pathParameters, {});
	});

	test("It should not overwrite queryStringParameters", async (t) => {
		const event = {
			httpMethod: "GET",
			queryStringParameters: { param: "hello" },
		};

		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.queryStringParameters, { param: "hello" });
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
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.queryStringParameters, { param: "hello" });
	});

	test("It should not overwrite multiValueQueryStringParameters", async (t) => {
		const event = {
			httpMethod: "GET",
			multiValueQueryStringParameters: { param: ["hello"] },
		};

		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.multiValueQueryStringParameters, {
			param: ["hello"],
		});
	});

	test("It should not overwrite pathParameters", async (t) => {
		const event = {
			httpMethod: "GET",
			pathParameters: { param: "hello" },
		};

		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.pathParameters, { param: "hello" });
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
		const normalizedEvent = await handler(event, defaultContext);

		deepStrictEqual(normalizedEvent.pathParameters, { param: "hello" });
	});

	// ALB does not URL-decode query parameters before invoking the target, so
	// the normalizer has to, using form semantics (`+` is a space).
	// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html
	const albEvent = (queryStringParameters, multi) => ({
		requestContext: {
			elb: { targetGroupArn: "arn:aws:elasticloadbalancing:" },
		},
		httpMethod: "GET",
		path: "/",
		queryStringParameters,
		multiValueQueryStringParameters: multi,
	});

	test("It should form-decode ALB queryStringParameters", async (t) => {
		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(
			albEvent({
				full_name: "Alex+Taylor",
				spaced: "Alex%20Taylor",
				plus: "Alex%2BTaylor",
				plain: "42",
			}),
			defaultContext,
		);

		deepStrictEqual(normalizedEvent.queryStringParameters, {
			full_name: "Alex Taylor",
			spaced: "Alex Taylor",
			plus: "Alex+Taylor",
			plain: "42",
		});
	});

	test("It should form-decode ALB queryStringParameter keys", async (t) => {
		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(
			albEvent({ "full+name": "1", "e%2Dmail": "2" }),
			defaultContext,
		);

		deepStrictEqual(normalizedEvent.queryStringParameters, {
			"full name": "1",
			"e-mail": "2",
		});
	});

	test("It should form-decode ALB multiValueQueryStringParameters", async (t) => {
		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(
			albEvent(
				{ full_name: "Sam+Lee" },
				{ full_name: ["Alex+Taylor", "Sam%20Lee"] },
			),
			defaultContext,
		);

		deepStrictEqual(normalizedEvent.multiValueQueryStringParameters, {
			full_name: ["Alex Taylor", "Sam Lee"],
		});
	});

	test("It should throw 400 on an ALB query parameter with invalid encoding", async (t) => {
		const handler = middy((event) => event).use(httpEventNormalizer());
		try {
			await handler(albEvent({ discount: "50%" }), defaultContext);
			ok(false, "expected throw");
		} catch (e) {
			strictEqual(e.statusCode, 400);
			strictEqual(e.cause.package, "@middy/http-event-normalizer");
		}
	});

	test("It should not decode query parameters of non-ALB events", async (t) => {
		const handler = middy((event) => event).use(httpEventNormalizer());
		const normalizedEvent = await handler(
			{
				httpMethod: "GET",
				queryStringParameters: { full_name: "Alex+Taylor" },
			},
			defaultContext,
		);

		deepStrictEqual(normalizedEvent.queryStringParameters, {
			full_name: "Alex+Taylor",
		});
	});

	test("httpEventNormalizerValidateOptions accepts empty options and rejects anything", () => {
		httpEventNormalizerValidateOptions({});
		httpEventNormalizerValidateOptions();
		try {
			httpEventNormalizerValidateOptions({ any: 1 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/http-event-normalizer");
		}
	});

	test("httpEventNormalizerValidateOptions validates options as a JSON-Schema object", () => {
		// The optionSchema is a JSON-Schema-shaped object ({ type: "object", ... }).
		// A non-object option must be rejected with the schema-form message
		// "Option '' must be object" rather than the flat-schema fallback
		// "options must be an object".
		try {
			httpEventNormalizerValidateOptions("not-an-object");
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.message, "Option '' must be object");
			strictEqual(e.cause.package, "@middy/http-event-normalizer");
		}
	});
});
