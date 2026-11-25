// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { contextNamespace, HttpError, validateOptions } from "@middy/util";

const name = "http-content-negotiation";
const pkg = `@middy/${name}`;

const listOf = (items) => ({
	type: "array",
	items,
	maxItems: 1024,
	uniqueItems: true,
	unevaluatedItems: false,
});

const contentCodings = ["br", "deflate", "gzip", "zstd", "identity"];

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:http-content-negotiation:options",
	type: "object",
	properties: {
		parseCharsets: { type: "boolean" },
		// RFC 9110 section 8.3.2: "charset = token"
		// https://www.rfc-editor.org/rfc/rfc9110#section-8.3.2
		availableCharsets: listOf({
			type: "string",
			maxLength: 1024,
			pattern: /^[\w!#$%&'*+.^`|~-]+$/u,
		}),
		defaultToFirstCharset: { type: "boolean" },
		parseEncodings: { type: "boolean" },
		availableEncodings: {
			...listOf({ type: "string", enum: contentCodings }),
			maxItems: contentCodings.length,
		},
		defaultToFirstEncoding: { type: "boolean" },
		parseLanguages: { type: "boolean" },
		// RFC 5646 section 2.1: every subtag is 1 to 8 alphanumerics, joined by "-"
		// https://www.rfc-editor.org/rfc/rfc5646#section-2.1
		availableLanguages: listOf({
			type: "string",
			maxLength: 1024,
			pattern: /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8}){0,127}$/u,
		}),
		defaultToFirstLanguage: { type: "boolean" },
		parseMediaTypes: { type: "boolean" },
		// RFC 9110 section 8.3.1 media-type with RFC 6838 section 4.2 restricted-name
		// https://www.rfc-editor.org/rfc/rfc9110#section-8.3.1
		// https://www.rfc-editor.org/rfc/rfc6838#section-4.2
		availableMediaTypes: listOf({
			type: "string",
			maxLength: 1024,
			pattern:
				/^[A-Za-z0-9][\w!#$&^.+-]{0,126}\/[A-Za-z0-9][\w!#$&^.+-]{0,126}(?:[ \t]*;[ \t]*[\w!#$%&'*+.^`|~-]+=(?:[\w!#$%&'*+.^`|~-]+|"[\t \x21\x23-\x5B\x5D-\x7E]*")){0,32}$/u,
		}),
		defaultToFirstMediaType: { type: "boolean" },
		failOnMismatch: { type: "boolean" },
		contextKey: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\x21-\x7E]+$/u,
		},
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const httpContentNegotiationValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

import charset from "negotiator/lib/charset.js";
import encoding from "negotiator/lib/encoding.js";
import language from "negotiator/lib/language.js";
import mediaType from "negotiator/lib/mediaType.js";

// RFC 9110 section 12.5.3: "If a non-empty Accept-Encoding header field is
// present in a request and none of the available representations for the
// response have a content coding that is listed as acceptable, the origin
// server SHOULD send a response without any content coding unless the
// identity coding is indicated as unacceptable."
// https://www.rfc-editor.org/rfc/rfc9110#section-12.5.3
const identityEncoding = ["identity"];
const parseEncoding = (headerValue, availableEncodings) => {
	const results = encoding(headerValue, availableEncodings);
	return results.length === 0
		? encoding(headerValue, identityEncoding)
		: results;
};

const parseFn = {
	Charset: charset,
	Encoding: parseEncoding,
	Language: language,
	MediaType: mediaType,
};

const defaults = {
	parseCharsets: true,
	availableCharsets: undefined,
	defaultToFirstCharset: false,
	parseEncodings: true,
	availableEncodings: undefined,
	defaultToFirstEncoding: false,
	parseLanguages: true,
	availableLanguages: undefined,
	defaultToFirstLanguage: false,
	parseMediaTypes: true,
	availableMediaTypes: undefined,
	defaultToFirstMediaType: false,
	failOnMismatch: true,
	contextKey: name,
};

const httpContentNegotiationMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const httpContentNegotiationMiddlewareBefore = (request) => {
		const { event } = request;
		if (!event.headers) return;
		const context = contextNamespace(request, options.contextKey);
		if (options.parseCharsets) {
			parseHeader(
				"Accept-Charset",
				"Charset",
				options.availableCharsets,
				options.defaultToFirstCharset,
				options.failOnMismatch,
				event,
				context,
			);
		}
		if (options.parseEncodings) {
			parseHeader(
				"Accept-Encoding",
				"Encoding",
				options.availableEncodings,
				options.defaultToFirstEncoding,
				options.failOnMismatch,
				event,
				context,
			);
		}

		if (options.parseLanguages) {
			parseHeader(
				"Accept-Language",
				"Language",
				options.availableLanguages,
				options.defaultToFirstLanguage,
				options.failOnMismatch,
				event,
				context,
			);
		}

		if (options.parseMediaTypes) {
			parseHeader(
				"Accept",
				"MediaType",
				options.availableMediaTypes,
				options.defaultToFirstMediaType,
				options.failOnMismatch,
				event,
				context,
			);
		}
	};

	return {
		before: httpContentNegotiationMiddlewareBefore,
	};
};

// Precomputed header descriptors: result names + lowercased header lookup
// keys are constant per type, but were built via template literals on every
// invocation. Hoisting them to module scope removes per-call string ops.
const headerDescriptors = {
	Charset: {
		lower: "accept-charset",
		resultsName: "preferredCharsets",
		resultName: "preferredCharset",
	},
	Encoding: {
		lower: "accept-encoding",
		resultsName: "preferredEncodings",
		resultName: "preferredEncoding",
	},
	Language: {
		lower: "accept-language",
		resultsName: "preferredLanguages",
		resultName: "preferredLanguage",
	},
	MediaType: {
		lower: "accept",
		resultsName: "preferredMediaTypes",
		resultName: "preferredMediaType",
	},
};

const parseHeader = (
	headerName,
	type,
	availableValues,
	defaultToFirstValue,
	failOnMismatch,
	event,
	context,
) => {
	const desc = headerDescriptors[type];
	const rawValue = event.headers[headerName] ?? event.headers[desc.lower];
	// VPC Lattice V2 sends each header as an array of its values; repeated
	// field lines combine with ", " (RFC 9110 §5.3).
	// https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html
	const headerValue = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;

	const results = parseFn[type](headerValue, availableValues);
	context[desc.resultsName] = results;
	context[desc.resultName] = results[0];

	if (typeof context[desc.resultName] === "undefined") {
		if (!Array.isArray(availableValues) || availableValues.length === 0) {
			return;
		}
		if (defaultToFirstValue) {
			context[desc.resultName] = availableValues[0];
		} else if (failOnMismatch) {
			// NotAcceptable
			throw new HttpError(406, {
				cause: {
					package: pkg,
					data: {
						reason: `Unsupported ${type}. Acceptable values: ${availableValues.join(", ")}`,
						[headerName]: headerValue,
					},
				},
			});
		}
	}
};

export default httpContentNegotiationMiddleware;
