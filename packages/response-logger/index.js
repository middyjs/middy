// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { Transform } from "node:stream";
import { TransformStream } from "node:stream/web";
import { buildPathTree, omit, validateOptions } from "@middy/util";

const name = "response-logger";
const pkg = `@middy/${name}`;

const defaults = {
	logger: ({ response }) => {
		console.log(JSON.stringify({ response }));
	},
	// Stryker disable next-line ArrayDeclaration: equivalent. A non-empty default keys the tree by its first path segment (e.g. "Stryker"), never a request key, so nothing on the request is ever matched, same as [].
	omitPaths: [],
	mask: undefined,
};

const optionSchema = {
	type: "object",
	properties: {
		logger: { oneOf: [{ instanceof: "Function" }, { const: false }] },
		omitPaths: { type: "array", items: { type: "string" } },
		mask: { type: "string" },
	},
	additionalProperties: false,
};

export const responseLoggerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const responseLoggerMiddleware = (opts = {}) => {
	const { logger, omitPaths, mask } = { ...defaults, ...opts };

	if (typeof logger !== "function") return {};

	const omitPathTree = buildPathTree(omitPaths);

	// A streamed response is only logged after flush, by which point `core` may
	// have cleared `request.response`, so the reconstructed body is grafted onto
	// a copy rather than written back to the live request.
	const logSnapshot = (request, response) =>
		logger(omit({ ...request, response }, omitPathTree, mask));

	const responseLoggerMiddlewareAfter = (request) => {
		const { response } = request;
		// Streams are teed so the body can be captured without consuming it.
		if (isNodeStream(response) || isNodeStream(response?.body)) {
			teeStream(request, logSnapshot, makeNodeTee);
		} else if (isWebStream(response) || isWebStream(response?.body)) {
			teeStream(request, logSnapshot, makeWebTee);
		} else {
			logger(omit(request, omitPathTree, mask));
		}
	};

	const responseLoggerMiddlewareOnError = (request) => {
		if (request.response !== undefined) responseLoggerMiddlewareAfter(request);
	};

	return {
		after: responseLoggerMiddlewareAfter,
		onError: responseLoggerMiddlewareOnError,
	};
};

const isNodeStream = (value) => Boolean(value?._readableState);
const isWebStream = (value) => value instanceof ReadableStream;

// The response shape is snapshotted at tee-time and the accumulated body
// reattached inside the flush callback. Each tee owns its own accumulation, so
// no decoder state leaks between streams on a warm container.
const teeStream = (request, log, makeTee) => {
	// Stryker disable next-line OptionalChaining: equivalent. teeStream is only reached from logResponse after a truthy `response` was confirmed to be (or to carry) a stream, so request.response is never null/undefined here and the `?.` never short-circuits.
	const hasBody = !!request.response?.body;
	const source = hasBody ? request.response.body : request.response;
	const snapshot = hasBody ? request.response : null;
	const onBody = (body) => {
		log(request, hasBody ? { ...snapshot, body } : body);
	};
	const piped = makeTee(source, onBody);
	// Stryker disable next-line ConditionalExpression: equivalent. The tee transform pulls from the original `source` stream regardless; whether `piped` is reattached to .body only changes which equivalent stream object the host pipes, and both deliver the same bytes and trigger the same flush/log.
	if (hasBody) request.response.body = piped;
	else request.response = piped;
};

const makeNodeTee = (source, onBody) => {
	// `objectMode: false` decodes string chunks to Buffers on the writable side.
	// Decoding once at flush keeps multi-byte UTF-8 sequences that straddle a
	// chunk boundary intact.
	const chunks = [];
	const transform = new Transform({
		objectMode: false,
		transform(chunk, encoding, callback) {
			chunks.push(chunk);
			this.push(chunk, encoding);
			callback();
		},
		flush(callback) {
			onBody(Buffer.concat(chunks).toString("utf8"));
			callback();
		},
	});
	return source.on("error", (e) => transform.destroy(e)).pipe(transform);
};

const makeWebTee = (source, onBody) => {
	// A fresh decoder per stream, so state never carries over on a warm container.
	const decoder = new TextDecoder();
	let body = "";
	const decodeWebChunk = (chunk) => {
		// Stryker disable next-line ConditionalExpression,StringLiteral: equivalent. Skipping the string fast-path lets a string chunk fall through to `return String(chunk)`, and String(str) === str, so the returned value is identical.
		if (typeof chunk === "string") return chunk;
		if (chunk instanceof Uint8Array)
			return decoder.decode(chunk, { stream: true });
		return String(chunk);
	};
	return source.pipeThrough(
		new TransformStream({
			transform(chunk, controller) {
				body += decodeWebChunk(chunk);
				controller.enqueue(chunk);
			},
			flush() {
				// Drain any buffered partial multi-byte bytes from the decoder.
				body += decoder.decode();
				onBody(body);
			},
		}),
	);
};

export default responseLoggerMiddleware;
