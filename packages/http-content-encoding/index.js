// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { kMaxLength } from "node:buffer";
import { pipeline, Readable } from "node:stream";
import { ReadableStream } from "node:stream/web";
import {
	createBrotliCompress as brotliCompressStream,
	brotliCompressSync,
	constants,
	createDeflate as deflateCompressStream,
	deflateSync,
	createGzip as gzipCompressStream,
	gzipSync,
	createZstdCompress as zstdCompressStream,
	zstdCompressSync,
} from "node:zlib";
import { normalizeHttpResponse, validateOptions } from "@middy/util";

const name = "http-content-encoding";
const pkg = `@middy/${name}`;

const integerRange = (minimum, maximum) => ({
	type: "integer",
	minimum,
	maximum,
});

const closedObject = (properties) => ({
	type: "object",
	properties,
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
});

// Node.js zlib: dictionary is "<Buffer> | <TypedArray> | <DataView> | <ArrayBuffer>"
// https://nodejs.org/docs/latest-v26.x/api/zlib.html#class-options
const dictionarySchema = {
	oneOf: [
		{ $ref: "#/$defs/ArrayBuffer" },
		{ $ref: "#/$defs/DataView" },
		{ $ref: "#/$defs/Int8Array" },
		{ $ref: "#/$defs/Uint8Array" },
		{ $ref: "#/$defs/Uint8ClampedArray" },
		{ $ref: "#/$defs/Int16Array" },
		{ $ref: "#/$defs/Uint16Array" },
		{ $ref: "#/$defs/Int32Array" },
		{ $ref: "#/$defs/Uint32Array" },
		{ $ref: "#/$defs/Float16Array" },
		{ $ref: "#/$defs/Float32Array" },
		{ $ref: "#/$defs/Float64Array" },
		{ $ref: "#/$defs/BigInt64Array" },
		{ $ref: "#/$defs/BigUint64Array" },
	],
};

const sharedOptions = (firstFlush, lastFlush) => ({
	flush: integerRange(firstFlush, lastFlush),
	finishFlush: integerRange(firstFlush, lastFlush),
	chunkSize: integerRange(constants.Z_MIN_CHUNK, kMaxLength),
	maxOutputLength: integerRange(1, kMaxLength),
	info: { type: "boolean" },
	rejectGarbageAfterEnd: { type: "boolean" },
});

// Node.js zlib "Class: Options"
// https://nodejs.org/docs/latest-v26.x/api/zlib.html#class-options
const zlibOptionsSchema = closedObject({
	...sharedOptions(constants.Z_NO_FLUSH, constants.Z_BLOCK),
	windowBits: integerRange(
		constants.Z_MIN_WINDOWBITS,
		constants.Z_MAX_WINDOWBITS,
	),
	level: integerRange(constants.Z_MIN_LEVEL, constants.Z_MAX_LEVEL),
	memLevel: integerRange(constants.Z_MIN_MEMLEVEL, constants.Z_MAX_MEMLEVEL),
	strategy: integerRange(constants.Z_DEFAULT_STRATEGY, constants.Z_FIXED),
	dictionary: dictionarySchema,
});

const brotliFlagSchema = {
	oneOf: [{ type: "boolean" }, { type: "integer", enum: [0, 1] }],
};

// Node.js zlib "Class: BrotliOptions" and "Compressor options"
// https://nodejs.org/docs/latest-v26.x/api/zlib.html#class-brotlioptions
// https://nodejs.org/docs/latest-v26.x/api/zlib.html#compressor-options
const brotliOptionsSchema = closedObject({
	...sharedOptions(
		constants.BROTLI_OPERATION_PROCESS,
		constants.BROTLI_OPERATION_EMIT_METADATA,
	),
	params: closedObject({
		[constants.BROTLI_PARAM_MODE]: {
			type: "integer",
			enum: [
				constants.BROTLI_MODE_GENERIC,
				constants.BROTLI_MODE_TEXT,
				constants.BROTLI_MODE_FONT,
			],
		},
		[constants.BROTLI_PARAM_QUALITY]: integerRange(
			constants.BROTLI_MIN_QUALITY,
			constants.BROTLI_MAX_QUALITY,
		),
		[constants.BROTLI_PARAM_LGWIN]: integerRange(
			constants.BROTLI_MIN_WINDOW_BITS,
			constants.BROTLI_LARGE_MAX_WINDOW_BITS,
		),
		[constants.BROTLI_PARAM_LGBLOCK]: integerRange(
			constants.BROTLI_MIN_INPUT_BLOCK_BITS,
			constants.BROTLI_MAX_INPUT_BLOCK_BITS,
		),
		[constants.BROTLI_PARAM_DISABLE_LITERAL_CONTEXT_MODELING]: brotliFlagSchema,
		// brotli encode.h: BrotliEncoderSetParameter(..., uint32_t value)
		// https://github.com/google/brotli/blob/master/c/include/brotli/encode.h
		[constants.BROTLI_PARAM_SIZE_HINT]: integerRange(0, 4294967295),
		[constants.BROTLI_PARAM_LARGE_WINDOW]: brotliFlagSchema,
		// "Ranges from 0 to BROTLI_MAX_NPOSTFIX", which brotli defines as 3
		// https://github.com/google/brotli/blob/master/c/common/constants.h
		[constants.BROTLI_PARAM_NPOSTFIX]: integerRange(0, 3),
		// "Ranges from 0 to 15 << NPOSTFIX", 120 at the largest NPOSTFIX
		[constants.BROTLI_PARAM_NDIRECT]: integerRange(0, 120),
	}),
});

// zstd.h: ZSTD_CCtx_setParameter(..., int value)
// https://github.com/facebook/zstd/blob/dev/lib/zstd.h
const zstdParamSchema = {
	oneOf: [integerRange(-2147483648, 2147483647), { type: "boolean" }],
};

// Node.js zlib "Class: ZstdOptions"; params are the ZSTD_c_* entries of
// zlib.constants, zstd's ZSTD_cParameter
// https://nodejs.org/docs/latest-v26.x/api/zlib.html#class-zstdoptions
// https://nodejs.org/docs/latest-v26.x/api/zlib.html#compressor-options-1
const zstdOptionsSchema = closedObject({
	...sharedOptions(constants.ZSTD_e_continue, constants.ZSTD_e_end),
	params: closedObject(
		Object.fromEntries(
			[
				constants.ZSTD_c_compressionLevel,
				constants.ZSTD_c_windowLog,
				constants.ZSTD_c_hashLog,
				constants.ZSTD_c_chainLog,
				constants.ZSTD_c_searchLog,
				constants.ZSTD_c_minMatch,
				constants.ZSTD_c_targetLength,
				constants.ZSTD_c_strategy,
				constants.ZSTD_c_enableLongDistanceMatching,
				constants.ZSTD_c_ldmHashLog,
				constants.ZSTD_c_ldmMinMatch,
				constants.ZSTD_c_ldmBucketSizeLog,
				constants.ZSTD_c_ldmHashRateLog,
				constants.ZSTD_c_contentSizeFlag,
				constants.ZSTD_c_checksumFlag,
				constants.ZSTD_c_dictIDFlag,
				constants.ZSTD_c_nbWorkers,
				constants.ZSTD_c_jobSize,
				constants.ZSTD_c_overlapLog,
			].map((param) => [param, zstdParamSchema]),
		),
	),
	pledgedSrcSize: integerRange(0, Number.MAX_SAFE_INTEGER),
	dictionary: dictionarySchema,
});

const encoderOption = (optionsSchema) => ({
	oneOf: [{ type: "boolean" }, optionsSchema],
});

const encodings = ["br", "deflate", "gzip", "zstd"];

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:http-content-encoding:options",
	$defs: {
		ArrayBuffer: false,
		DataView: false,
		Int8Array: false,
		Uint8Array: false,
		Uint8ClampedArray: false,
		Int16Array: false,
		Uint16Array: false,
		Int32Array: false,
		Uint32Array: false,
		Float16Array: false,
		Float32Array: false,
		Float64Array: false,
		BigInt64Array: false,
		BigUint64Array: false,
	},
	type: "object",
	properties: {
		br: encoderOption(brotliOptionsSchema),
		deflate: encoderOption(zlibOptionsSchema),
		gzip: encoderOption(zlibOptionsSchema),
		zstd: encoderOption(zstdOptionsSchema),
		overridePreferredEncoding: {
			type: "array",
			items: { type: "string", enum: encodings },
			maxItems: encodings.length,
			uniqueItems: true,
			unevaluatedItems: false,
		},
		contextKeyHttpContentNegotiation: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\x21-\x7E]+$/u,
		},
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const httpContentEncodingValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const contentEncodingStreams = {
	br: brotliCompressStream,
	deflate: deflateCompressStream,
	gzip: gzipCompressStream,
	zstd: zstdCompressStream,
};

const contentEncodingSync = {
	br: brotliCompressSync,
	deflate: deflateSync,
	gzip: gzipSync,
	zstd: zstdCompressSync,
};

const defaults = {
	br: undefined,
	deflate: undefined,
	gzip: undefined,
	zstd: undefined,
	overridePreferredEncoding: undefined,
	// Where @middy/http-content-negotiation published its results; must match
	// that middleware's `contextKey` when it has been overridden.
	contextKeyHttpContentNegotiation: "http-content-negotiation",
};

export const getContentEncodingStream = (preferredEncoding, encoderOptions) => {
	return contentEncodingStreams[preferredEncoding](encoderOptions);
};

const httpContentEncodingMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const supportedContentEncodings = Object.keys(contentEncodingStreams);
	// `{ [encoding]: false }` disables that encoder.
	const disabledContentEncodings = new Set(
		supportedContentEncodings.filter((encoding) => options[encoding] === false),
	);
	const isEnabledContentEncoding = (encoding) =>
		!disabledContentEncodings.has(encoding);

	const contextKeyHttpContentNegotiation =
		options.contextKeyHttpContentNegotiation;

	const httpContentEncodingMiddlewareAfter = (request) => {
		normalizeHttpResponse(request);
		const { response } = request;
		let { preferredEncoding, preferredEncodings } =
			request.context.middyContext?.[contextKeyHttpContentNegotiation] ?? {};
		// Drop disabled encodings from the negotiated list so the client's next
		// acceptable encoding (or identity) is used instead. Unconditional: the
		// list holds at most four entries, and a fast path for "nothing disabled"
		// only added a branch that no test could tell apart from its absence.
		preferredEncodings = preferredEncodings?.filter(isEnabledContentEncoding);
		if (!isEnabledContentEncoding(preferredEncoding)) {
			preferredEncoding = preferredEncodings?.[0];
		}

		// Encoding not supported, already encoded, or doesn't need to
		const eventCacheControl = readHeader(
			request.event?.headers,
			request.event?.multiValueHeaders,
			"cache-control",
		);
		if (eventCacheControl?.includes("no-transform")) {
			addHeaderPart(response, "Cache-Control", "no-transform");
		}
		const responseCacheControl = readHeader(
			response.headers,
			response.multiValueHeaders,
			"cache-control",
		);
		const isNodeStream = response.body?._readableState;
		const isWebStream = response.body instanceof ReadableStream;
		const responseContentEncoding = readHeader(
			response.headers,
			response.multiValueHeaders,
			"content-encoding",
		);
		if (
			response.isBase64Encoded ||
			responseContentEncoding ||
			!preferredEncoding ||
			!supportedContentEncodings.includes(preferredEncoding) ||
			!response.body ||
			(typeof response.body !== "string" &&
				!Buffer.isBuffer(response.body) &&
				!isNodeStream &&
				!isWebStream) ||
			responseCacheControl?.includes("no-transform")
		) {
			return;
		}

		// Resolve encoding choice before creating any stream
		let contentEncoding = preferredEncoding;
		if (options.overridePreferredEncoding) {
			for (const encoding of options.overridePreferredEncoding) {
				if (!preferredEncodings?.includes(encoding)) continue;
				contentEncoding = encoding;
				break;
			}
		}

		// Support streamifyResponse
		if (isNodeStream || isWebStream) {
			const contentEncodingStream = contentEncodingStreams[contentEncoding](
				options[contentEncoding],
			);
			markEncoded(response, contentEncoding);
			// pipeline, not .pipe(): a source that fails destroys the encoder with
			// the same error, so the response stream errors instead of hanging and
			// nothing escapes as an uncaught exception. The error reaches whoever
			// consumes the body, so the callback has nothing left to do.
			const source = isNodeStream
				? response.body
				: // The outer guard leaves only a web stream here.
					Readable.fromWeb(response.body);
			const encoded = pipeline(source, contentEncodingStream, noop);
			request.response.body = isNodeStream ? encoded : Readable.toWeb(encoded);
			return;
		}
		// isString/isBuffer, use sync compression (avoids stream overhead)
		const inputBuffer = Buffer.isBuffer(response.body)
			? response.body
			: Buffer.from(response.body);
		const compressed = contentEncodingSync[contentEncoding](
			inputBuffer,
			options[contentEncoding],
		);

		// Only apply encoding if it's smaller
		if (compressed.length < inputBuffer.length) {
			markEncoded(response, contentEncoding);
			response.body = compressed.toString("base64");
			response.isBase64Encoded = true;
		}

		request.response = response;
	};

	const httpContentEncodingMiddlewareOnError = (request) => {
		if (typeof request.response === "undefined") return;
		httpContentEncodingMiddlewareAfter(request);
	};

	return {
		after: httpContentEncodingMiddlewareAfter,
		onError: httpContentEncodingMiddlewareOnError,
	};
};

const noop = () => {};

// ALB with multi-value headers enabled sends and expects `multiValueHeaders`
// only, so both maps are read and a response that uses `multiValueHeaders` is
// written there.
// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers
const readHeader = (headers, multiValueHeaders, lowerName) => {
	for (const map of [headers, multiValueHeaders]) {
		if (!map) continue;
		for (const key of Object.keys(map)) {
			if (key.toLowerCase() === lowerName) {
				const value = map[key];
				return Array.isArray(value) ? value.join(", ") : value;
			}
		}
	}
	return undefined;
};

const weakenETag = (value) => (value.startsWith("W/") ? value : `W/${value}`);

// The encoded body is a different representation: Content-Length described the
// unencoded one (RFC 9110 §8.6), and a strong ETag has to change with the
// content coding (RFC 9110 §8.8.3), so it is weakened. A weak one is kept.
const encodedHeaders = (map, isMultiValue) => {
	const headers = {};
	for (const key of Object.keys(map)) {
		const lower = key.toLowerCase();
		if (lower === "content-length") continue;
		const value = map[key];
		if (lower !== "etag") {
			headers[key] = value;
		} else {
			headers[key] = isMultiValue ? value.map(weakenETag) : weakenETag(value);
		}
	}
	return headers;
};

const markEncoded = (response, contentEncoding) => {
	response.headers = encodedHeaders(response.headers, false);
	if (response.multiValueHeaders) {
		response.multiValueHeaders = encodedHeaders(
			response.multiValueHeaders,
			true,
		);
		response.multiValueHeaders["Content-Encoding"] = [contentEncoding];
	} else {
		response.headers["Content-Encoding"] = contentEncoding;
	}
	addHeaderPart(response, "Vary", "Accept-Encoding");
};

// header in official name, lowercase variant handled. A response that uses
// multiValueHeaders gets the value as one more line of that header.
const addHeaderPart = (response, header, value) => {
	const headerLower = header.toLowerCase();
	if (response.multiValueHeaders) {
		const existing = Object.keys(response.multiValueHeaders).find(
			(key) => key.toLowerCase() === headerLower,
		);
		if (existing) {
			response.multiValueHeaders[existing] = [
				...response.multiValueHeaders[existing],
				value,
			];
		} else {
			response.multiValueHeaders[header] = [value];
		}
		return;
	}
	const sanitizedHeader = response.headers[headerLower] ? headerLower : header;
	response.headers[sanitizedHeader] ??= "";
	response.headers[sanitizedHeader] &&=
		`${response.headers[sanitizedHeader]}, `;
	response.headers[sanitizedHeader] += value;
};

export default httpContentEncodingMiddleware;
