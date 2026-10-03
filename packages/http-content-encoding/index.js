// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { pipeline, Readable } from "node:stream";
import { ReadableStream } from "node:stream/web";
import {
	createBrotliCompress as brotliCompressStream,
	brotliCompressSync,
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

const encoderOption = {
	oneOf: [{ type: "boolean" }, { type: "object" }],
};

const optionSchema = {
	type: "object",
	properties: {
		br: encoderOption,
		deflate: encoderOption,
		gzip: encoderOption,
		zstd: encoderOption,
		overridePreferredEncoding: {
			type: "array",
			items: { type: "string", enum: ["br", "deflate", "gzip", "zstd"] },
		},
		contextKeyHttpContentNegotiation: { type: "string" },
	},
	additionalProperties: false,
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
