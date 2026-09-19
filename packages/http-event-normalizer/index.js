// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	HttpError,
	resolveHttpEventVersion,
	validateOptions,
} from "@middy/util";

const name = "http-event-normalizer";
const pkg = `@middy/${name}`;

const optionSchema = {
	type: "object",
	properties: {},
	additionalProperties: false,
};

export const httpEventNormalizerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// ALB is the only supported HTTP source that hands over query parameters still
// URL-encoded: "If the query parameters are URL-encoded, the load balancer does
// not decode them. You must decode them in your Lambda function."
// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html
// A query string is form-encoded, so `+` is a space; decodeURIComponent on its
// own would leave it as a literal plus.
const formDecode = (value) => {
	try {
		return decodeURIComponent(value.replaceAll("+", "%20"));
	} catch (_e) {
		throw new HttpError(400, {
			cause: {
				package: pkg,
				data: { reason: "Invalid query parameter encoding", value },
			},
		});
	}
};

const formDecodeParameters = (params) => {
	const decoded = {};
	for (const key of Object.keys(params)) {
		const value = params[key];
		decoded[formDecode(key)] = Array.isArray(value)
			? value.map((entry) => formDecode(entry))
			: formDecode(value);
	}
	return decoded;
};

const httpEventNormalizerMiddleware = () => {
	const httpEventNormalizerMiddlewareBefore = (request) => {
		const { event } = request;

		const version = resolveHttpEventVersion(event);
		// VPC Lattice is an http event, however uses a different notation
		// - query_string_parameters
		// - is_base64_encoded

		if (version === "1.0") {
			event.multiValueQueryStringParameters ??= {};
		} else if (version === "vpc") {
			event.queryStringParameters = event.query_string_parameters;
			event.isBase64Encoded = event.is_base64_encoded;
		}

		// event.headers ??= {} // Will always have at least one header
		event.pathParameters ??= {};
		event.queryStringParameters ??= {};

		// ALB events resolve to '1.0', so both maps are defaulted by here.
		if (event.requestContext?.elb) {
			event.queryStringParameters = formDecodeParameters(
				event.queryStringParameters,
			);
			event.multiValueQueryStringParameters = formDecodeParameters(
				event.multiValueQueryStringParameters,
			);
		}
	};

	return {
		before: httpEventNormalizerMiddlewareBefore,
	};
};

export default httpEventNormalizerMiddleware;
