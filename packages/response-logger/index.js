// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { constants as bufferConstants } from "node:buffer";
import { Transform } from "node:stream";
import { TransformStream } from "node:stream/web";
import {
	buildPathTree,
	omit,
	omitPathsSchema,
	pathTreeOmitsString,
	validateOmitPaths,
	validateOptions,
} from "@middy/util";

const name = "response-logger";
const pkg = `@middy/${name}`;

// Largest single log event CloudWatch Logs accepts: "Event size: 1,024
// Kilobytes", "The maximum log event size in KB".
// https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/cloudwatch_limits_cwl.html
// The table counts in binary units: its "Batch size: 1 Megabytes" is stated
// by the API reference as "The maximum batch size is 1,048,576 bytes".
// https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_PutLogEvents.html
const CLOUDWATCH_LOGS_EVENT_MAX_BYTES = 1024 * 1024;

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
	maxBodyBytes: CLOUDWATCH_LOGS_EVENT_MAX_BYTES,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:response-logger:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		logger: { $ref: "#/$defs/Function" },
		omitPaths: omitPathsSchema,
		mask: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\p{L}\p{N}\p{P}\p{S} ]*$/u,
		},
		// The logged body is one string: "the largest length allowed for a single
		// string instance". https://nodejs.org/api/buffer.html#bufferconstantsmax_string_length
		maxBodyBytes: {
			type: "integer",
			minimum: 1,
			maximum: bufferConstants.MAX_STRING_LENGTH,
		},
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const responseLoggerValidateOptions = (options) => {
	const validated = validateOptions(pkg, optionSchema, options);
	validateOmitPaths(validated.omitPaths);
	return validated;
};

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

	const omitPathTree = omitPaths ? buildPathTree(omitPaths) : undefined;
	const redactsResponse = pathTreeOmitsString(omitPathTree, ["response"]);
	const redactsResponseBody = pathTreeOmitsString(omitPathTree, [
		"response",
		"body",
	]);

	const unreadBody = () => makeBodyCapture(maxBodyBytes).end();

	// A streamed response is only logged after flush, by which point `core` may
	// have cleared `request.response`, so the reconstructed body is grafted onto
	// a copy rather than written back to the live request.
	const logSnapshot = (request, response) =>
		logger(omit({ ...request, response }, omitPathTree, mask));
	const logRequest = (request) => logger(omit(request, omitPathTree, mask));

	const responseLoggerMiddlewareAfter = (request) => {
		const { response } = request;
		const makeTee = selectTee(response);
		if (makeTee === undefined) return logSafely(logRequest, request);
		if (response.body) {
			const logBody = (body) => logSnapshot(request, { ...response, body });
			if (redactsResponseBody) return logSafely(logBody, unreadBody());
			response.body = makeTee(response.body, logBody, maxBodyBytes);
		} else {
			const logBody = (body) => logSnapshot(request, body);
			if (redactsResponse) return logSafely(logBody, unreadBody());
			request.response = makeTee(response, logBody, maxBodyBytes);
		}
	};

	const responseLoggerMiddlewareOnError = (request) => {
		if (request.response !== undefined) {
			return responseLoggerMiddlewareAfter(request);
		}
	};

	return {
		after: responseLoggerMiddlewareAfter,
		onError: responseLoggerMiddlewareOnError,
	};
};

const isNodeStream = (value) => Boolean(value?._readableState);
const isWebStream = (value) => value instanceof ReadableStream;

const selectTee = (response) => {
	if (isNodeStream(response) || isNodeStream(response?.body)) {
		return makeNodeTee;
	}
	if (isWebStream(response) || isWebStream(response?.body)) {
		return makeWebTee;
	}
};

// Decodes at most `maxBodyBytes` of a streamed body for the log.
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
			const logged = logSafely(onBody, capture.end());
			if (logged === undefined) {
				callback();
			} else {
				logged.then(() => callback());
			}
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
		const logged = log(value);
		if (typeof logged?.then === "function") {
			return settleLoggerPromise(logged);
		}
	} catch (e) {
		console.error(e);
	}
};

const settleLoggerPromise = async (logged) => {
	try {
		await logged;
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
				return logSafely(onBody, capture.end());
			},
		}),
	);
};

export default responseLoggerMiddleware;
