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
	omitPaths: undefined,
	mask: undefined,
};

const optionSchema = {
	type: "object",
	properties: {
		logger: { instanceof: "Function" },
		omitPaths: { type: "array", items: { type: "string" } },
		mask: { type: "string" },
	},
	additionalProperties: false,
};

export const responseLoggerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const responseLoggerMiddleware = (opts = {}) => {
	// `{ ...defaults, ...opts }` lets an explicit `logger: undefined` override
	// the default; the destructuring default restores it, matching the option
	// validator, which treats an undefined property as absent.
	const {
		logger = defaults.logger,
		omitPaths,
		mask,
	} = { ...defaults, ...opts };

	// Logging is this middleware's only job, so there is no "off" setting: omit
	// the middleware instead. The validator keeps the generic option wording;
	// this names the fix.
	if (typeof logger !== "function") {
		throw new TypeError(
			`Option 'logger' must be a function; ${pkg} only logs, omit the middleware to disable logging`,
			{ cause: { package: pkg } },
		);
	}

	const omitPathTree = omitPaths && buildPathTree(omitPaths);

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
	// `response` is a stream, or carries one on `.body`: the caller only reaches
	// here once one of those held, so neither access needs guarding.
	const { response } = request;
	if (response.body) {
		response.body = makeTee(response.body, (body) =>
			log(request, { ...response, body }),
		);
	} else {
		request.response = makeTee(response, (body) => log(request, body));
	}
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
			logBody(onBody, Buffer.concat(chunks).toString("utf8"));
			callback();
		},
	});
	// A consumer that destroys the tee early (client gone, pipeline error)
	// would otherwise leave the source unpiped, paused and never destroyed.
	transform.once("close", () => {
		// Stryker disable next-line ConditionalExpression: equivalent; Readable.destroy() returns early on an already-destroyed stream, so the guard only skips a no-op call.
		if (!source.destroyed) source.destroy();
	});
	return source.on("error", (e) => transform.destroy(e)).pipe(transform);
};

// The logger runs inside the tee's flush, so a throw there would surface as a
// stream error and fail a response whose body has already been written out.
const logBody = (onBody, body) => {
	try {
		onBody(body);
	} catch (e) {
		console.error(e);
	}
};

const makeWebTee = (source, onBody) => {
	// A fresh decoder per stream, so state never carries over on a warm container.
	const decoder = new TextDecoder();
	let body = "";
	// `String(chunk)` is a no-op on the string chunks the streaming API also
	// emits, so bytes are the only case needing the decoder.
	const decodeWebChunk = (chunk) =>
		chunk instanceof Uint8Array
			? decoder.decode(chunk, { stream: true })
			: String(chunk);
	return source.pipeThrough(
		new TransformStream({
			transform(chunk, controller) {
				body += decodeWebChunk(chunk);
				controller.enqueue(chunk);
			},
			flush() {
				// Drain any buffered partial multi-byte bytes from the decoder.
				body += decoder.decode();
				logBody(onBody, body);
			},
		}),
	);
};

export default responseLoggerMiddleware;
