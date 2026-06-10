// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createError, validateOptions } from "@middy/util";

const name = "http-content-negotiation";
const pkg = `@middy/${name}`;

const optionSchema = {
	type: "object",
	properties: {
		parseCharsets: { type: "boolean" },
		availableCharsets: { type: "array", items: { type: "string" } },
		defaultToFirstCharset: { type: "boolean" },
		parseEncodings: { type: "boolean" },
		availableEncodings: {
			type: "array",
			items: {
				type: "string",
				enum: ["br", "deflate", "gzip", "zstd", "identity"],
			},
		},
		defaultToFirstEncoding: { type: "boolean" },
		parseLanguages: { type: "boolean" },
		availableLanguages: { type: "array", items: { type: "string" } },
		defaultToFirstLanguage: { type: "boolean" },
		parseMediaTypes: { type: "boolean" },
		availableMediaTypes: { type: "array", items: { type: "string" } },
		defaultToFirstMediaType: { type: "boolean" },
		failOnMismatch: { type: "boolean" },
	},
	additionalProperties: false,
};

export const httpContentNegotiationValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

import charset from "negotiator/lib/charset.js";
import encoding from "negotiator/lib/encoding.js";
import language from "negotiator/lib/language.js";
import mediaType from "negotiator/lib/mediaType.js";

const parseFn = {
	Charset: charset,
	Encoding: encoding,
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
};

const httpContentNegotiationMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const httpContentNegotiationMiddlewareBefore = (request) => {
		const { event, context } = request;
		if (!event.headers) return;
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
		// Stryker disable next-line StringLiteral: `header` is unused; header lookup goes through the headerName argument and `lower`.
		header: "Accept-Charset",
		lower: "accept-charset",
		resultsName: "preferredCharsets",
		resultName: "preferredCharset",
	},
	Encoding: {
		// Stryker disable next-line StringLiteral: `header` is unused; header lookup goes through the headerName argument and `lower`.
		header: "Accept-Encoding",
		lower: "accept-encoding",
		resultsName: "preferredEncodings",
		resultName: "preferredEncoding",
	},
	Language: {
		// Stryker disable next-line StringLiteral: `header` is unused; header lookup goes through the headerName argument and `lower`.
		header: "Accept-Language",
		lower: "accept-language",
		resultsName: "preferredLanguages",
		resultName: "preferredLanguage",
	},
	MediaType: {
		// Stryker disable next-line StringLiteral: `header` is unused; header lookup goes through the headerName argument and `lower`.
		header: "Accept",
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
	const headerValue = event.headers[headerName] ?? event.headers[desc.lower];

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
			throw createError(
				406,
				`Unsupported ${type}. Acceptable values: ${availableValues.join(", ")}`,
				{
					cause: {
						package: pkg,
						data: { [headerName]: headerValue },
					},
				},
			);
		}
	}
};

export default httpContentNegotiationMiddleware;
