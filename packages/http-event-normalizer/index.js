// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
const httpEventNormalizerMiddleware = () => {
	const httpEventNormalizerMiddlewareBefore = async (request) => {
		const { event } = request;

		const version = pickVersion(event);
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
	};

	return {
		before: httpEventNormalizerMiddlewareBefore,
	};
};

const pickVersion = (event) => {
	// '1.0' is a safer default
	return event.version ?? (event.method ? "vpc" : "1.0");
};

export default httpEventNormalizerMiddleware;
