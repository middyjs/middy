// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { Transform } from "node:stream";
import { TransformStream } from "node:stream/web";
import { buildPathTree, omit, validateOptions } from "@middy/util";

const name = "response-logger";
const pkg = `@middy/${name}`;

// Largest response Lambda can stream: "200 MB for each streamed response",
// where "the Lambda documentation ... use[s] the abbreviation MB (rather than
// MiB) to refer to 1,024 KB".
// docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
const LAMBDA_STREAMED_RESPONSE_MAX_BYTES = 200 * 1024 * 1024;

// JSON.stringify throws on BigInt, which event-normalizer produces for
// DynamoDB numbers beyond 2^53.
const stringifyBigInt = (_key, value) =>
	typeof value === "bigint" ? value.toString() : value;

const defaults = {
	logger: ({ response }) => {
		console.log(JSON.stringify({ response }, stringifyBigInt));
	},
	omitPaths: undefined,
	mask: undefined,
	maxBodyBytes: LAMBDA_STREAMED_RESPONSE_MAX_BYTES,
};

const optionSchema = {
	type: "object",
	properties: {
		logger: { instanceof: "Function" },
		omitPaths: { type: "array", items: { type: "string" } },
		mask: { type: "string" },
		maxBodyBytes: { type: "integer", minimum: 1 },
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
		maxBodyBytes = defaults.maxBodyBytes,
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
	const logRequest = (request) => logger(omit(request, omitPathTree, mask));

	const responseLoggerMiddlewareAfter = (request) => {
		const { response } = request;
		// Streams are teed so the body can be captured without consuming it.
		if (isNodeStream(response) || isNodeStream(response?.body)) {
			teeStream(request, logSnapshot, makeNodeTee, maxBodyBytes);
		} else if (isWebStream(response) || isWebStream(response?.body)) {
			teeStream(request, logSnapshot, makeWebTee, maxBodyBytes);
		} else {
			logSafely(logRequest, request);
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
const teeStream = (request, log, makeTee, maxBodyBytes) => {
	// `response` is a stream, or carries one on `.body`: the caller only reaches
	// here once one of those held, so neither access needs guarding.
	const { response } = request;
	if (response.body) {
		response.body = makeTee(
			response.body,
			(body) => log(request, { ...response, body }),
			maxBodyBytes,
		);
	} else {
		request.response = makeTee(
			response,
			(body) => log(request, body),
			maxBodyBytes,
		);
	}
};

// Decodes at most `maxBodyBytes` of a streamed body for the log. A streamed
// response can be far larger than a log line should be (Lambda response
// streaming allows up to 200 MB), so bytes past the cap are counted but not
// kept. A fresh decoder per stream, so state never carries over on a warm
// container; streaming decode keeps multi-byte UTF-8 sequences that straddle
// a chunk boundary intact, and one cut by the cap is dropped, not mangled.
const makeBodyCapture = (maxBodyBytes) => {
	const decoder = new TextDecoder();
	let body = "";
	let bytes = 0;
	return {
		add(chunk) {
			const remaining = maxBodyBytes - bytes;
			bytes += chunk.byteLength;
			if (remaining <= 0) return;
			body += decoder.decode(
				chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk,
				{ stream: true },
			);
		},
		end() {
			if (bytes > maxBodyBytes) {
				return `${body}...[truncated, logged ${maxBodyBytes} of ${bytes} bytes]`;
			}
			// Drain any buffered partial multi-byte bytes from the decoder.
			return body + decoder.decode();
		},
	};
};

const makeNodeTee = (source, onBody, maxBodyBytes) => {
	// `objectMode: false` decodes string chunks to Buffers on the writable side.
	const capture = makeBodyCapture(maxBodyBytes);
	const transform = new Transform({
		objectMode: false,
		transform(chunk, encoding, callback) {
			capture.add(chunk);
			this.push(chunk, encoding);
			callback();
		},
		flush(callback) {
			logSafely(onBody, capture.end());
			callback();
		},
	});
	// A consumer that destroys the tee early (client gone, pipeline error)
	// would otherwise leave the source unpiped, paused and never destroyed.
	// `destroy()` is a no-op on a stream that is already destroyed.
	transform.once("close", () => source.destroy());
	return source.on("error", (e) => transform.destroy(e)).pipe(transform);
};

// A logger that throws is reported, not propagated: logging must not change
// the invocation outcome. Inside a tee's flush a throw would also surface as a
// stream error and fail a response whose body has already been written out.
const logSafely = (log, value) => {
	try {
		log(value);
	} catch (e) {
		console.error(e);
	}
};

const encoder = new TextEncoder();

const makeWebTee = (source, onBody, maxBodyBytes) => {
	const capture = makeBodyCapture(maxBodyBytes);
	return source.pipeThrough(
		new TransformStream({
			transform(chunk, controller) {
				// The streaming API also emits strings (and anything else is
				// stringified), which are encoded so the cap counts bytes.
				capture.add(
					chunk instanceof Uint8Array ? chunk : encoder.encode(String(chunk)),
				);
				controller.enqueue(chunk);
			},
			flush() {
				logSafely(onBody, capture.end());
			},
		}),
	);
};

export default responseLoggerMiddleware;
