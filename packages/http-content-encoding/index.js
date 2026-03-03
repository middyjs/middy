// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { Readable } from "node:stream";
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
import { normalizeHttpResponse } from "@middy/util";

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
	overridePreferredEncoding: [],
};

export const getContentEncodingStream = (preferredEncoding) => {
	return contentEncodingStreams[preferredEncoding]();
};

const httpContentEncodingMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const supportedContentEncodings = Object.keys(contentEncodingStreams);

	const httpContentEncodingMiddlewareAfter = async (request) => {
		normalizeHttpResponse(request);
		const {
			context: { preferredEncoding, preferredEncodings },
			response,
		} = request;

		// Encoding not supported, already encoded, or doesn't need to
		const eventCacheControl =
			request.event?.headers?.["cache-control"] ??
			request.event?.headers?.["Cache-Control"];
		if (eventCacheControl?.includes("no-transform")) {
			addHeaderPart(response, "Cache-Control", "no-transform");
		}
		const responseCacheControl =
			response.headers["Cache-Control"] ?? response.headers["cache-control"];
		const isNodeStream = response.body?._readableState;
		const isWebStream = response.body instanceof ReadableStream;
		if (
			response.isBase64Encoded ||
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
		for (const encoding of options.overridePreferredEncoding) {
			if (!preferredEncodings.includes(encoding)) continue;
			contentEncoding = encoding;
			break;
		}

		// Support streamifyResponse
		if (isNodeStream || isWebStream) {
			const contentEncodingStream = contentEncodingStreams[contentEncoding](
				options[contentEncoding],
			);
			request.response.headers["Content-Encoding"] = contentEncoding;
			if (isNodeStream) {
				request.response.body = request.response.body.pipe(
					contentEncodingStream,
				);
			} else if (isWebStream) {
				request.response.body = Readable.toWeb(
					Readable.fromWeb(response.body).pipe(contentEncodingStream),
				);
			}
			addHeaderPart(response, "Vary", "Accept-Encoding");
			return;
		}
		// isString/isBuffer — use sync compression (avoids stream overhead)
		const inputBuffer = Buffer.isBuffer(response.body)
			? response.body
			: Buffer.from(response.body);
		const compressed = contentEncodingSync[contentEncoding](inputBuffer);
		const body = compressed.toString("base64");

		// Only apply encoding if it's smaller
		if (body.length < response.body.length) {
			response.headers["Content-Encoding"] = contentEncoding;
			response.body = body;
			response.isBase64Encoded = true;
			addHeaderPart(response, "Vary", "Accept-Encoding");
		}

		request.response = response;
	};

	const httpContentEncodingMiddlewareOnError = async (request) => {
		if (typeof request.response === "undefined") return;
		await httpContentEncodingMiddlewareAfter(request);
	};

	return {
		after: httpContentEncodingMiddlewareAfter,
		onError: httpContentEncodingMiddlewareOnError,
	};
};

// header in official name, lowercase variant handled
const addHeaderPart = (response, header, value) => {
	const headerLower = header.toLowerCase();
	const sanitizedHeader = response.headers[headerLower] ? headerLower : header;
	response.headers[sanitizedHeader] ??= "";
	response.headers[sanitizedHeader] &&=
		`${response.headers[sanitizedHeader]}, `;
	response.headers[sanitizedHeader] += value;
};

export default httpContentEncodingMiddleware;
