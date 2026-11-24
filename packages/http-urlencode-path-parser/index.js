// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { HttpError, validateOptions } from "@middy/util";

const name = "http-urlencode-path-parser";
const pkg = `@middy/${name}`;

// Stryker disable next-line ObjectLiteral: with no properties, this JSON schema and an empty flat schema reject exactly the same inputs with the same messages.
const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:http-urlencode-path-parser:options",
	type: "object",
	properties: {},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const httpUrlencodePathParserValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// HTTP API: "API Gateway decodes URL-encoded request parameters before passing
// them to your backend integration."
// https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-routes.html
// Its payload format 2.0 events, which Lambda function URLs share, carry
// `requestContext.http`.
// https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
// A VPC Lattice V2 event is `version: "2.0"` as well, but has no
// `requestContext.http`.
// https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html#event-structure-v2
const hasRequestContextHttp = (event) =>
	event.requestContext?.http !== undefined;

const httpUrlencodePathParserMiddlewareBefore = (request) => {
	const { event } = request;
	if (hasRequestContextHttp(event)) return;
	const params = event.pathParameters;
	if (!params) return;
	for (const key of Object.keys(params)) {
		const value = params[key];
		if (typeof value !== "string") continue;
		try {
			params[key] = decodeURIComponent(value);
		} catch (_e) {
			throw new HttpError(400, {
				cause: {
					package: pkg,
					data: { reason: "Invalid path parameter encoding", key },
				},
			});
		}
	}
};

const httpUrlencodePathParserMiddleware = () => ({
	before: httpUrlencodePathParserMiddlewareBefore,
});
export default httpUrlencodePathParserMiddleware;
