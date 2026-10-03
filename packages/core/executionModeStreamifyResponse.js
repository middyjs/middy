// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
/* global awslambda */
import { Buffer } from "node:buffer";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import { ReadableStream } from "node:stream/web";

export const executionModeStreamifyResponse = (
	{ middyRequest, runRequest },
	beforeMiddlewares,
	lambdaHandler,
	afterMiddlewares,
	onErrorMiddlewares,
	plugin,
) => {
	const middy = awslambda.streamifyResponse(
		async (event, lambdaResponseStream, context) => {
			const request = middyRequest(event, context);
			plugin.requestStart(request);
			// The middleware/handler run and the stream write share one try so
			// that requestEnd still runs when a middleware or the handler throws;
			// the request error is rethrown after requestEnd runs.
			let requestError;
			let hasError = false;
			try {
				const handlerResponse = await runRequest(
					request,
					beforeMiddlewares,
					lambdaHandler,
					afterMiddlewares,
					onErrorMiddlewares,
					plugin,
				);
				let handlerBody = handlerResponse ?? "";
				let prelude;
				if (handlerResponse?.statusCode) {
					const { body, ...restResponse } = handlerResponse;
					handlerBody = body ?? ""; // #1137
					prelude = restResponse;
				}
				// Classify the body before any byte goes out: the prelude commits
				// the status to the client, so an invalid body must throw first.
				let writeBody;
				if (typeof handlerBody === "string") {
					writeBody = writeString;
				} else if (ArrayBuffer.isView(handlerBody)) {
					writeBody = writeBinary;
				} else if (
					handlerBody._readableState ||
					handlerBody instanceof ReadableStream
				) {
					writeBody = writeStream;
				} else {
					throw new Error(
						"handler response not a string, Buffer, TypedArray, DataView, Readable or ReadableStream",
						{
							cause: { package: "@middy/core" },
						},
					);
				}
				let responseStream = lambdaResponseStream;
				if (prelude) {
					responseStream = awslambda.HttpResponseStream.from(
						responseStream,
						prelude,
					);
					responseStream.write("");
				}
				await writeBody(responseStream, handlerBody);
			} catch (err) {
				requestError = err;
				hasError = true;
			}
			try {
				const requestEndResult = plugin.requestEnd(request);
				if (requestEndResult instanceof Promise) await requestEndResult;
			} catch (hookErr) {
				if (!hasError) throw hookErr;
				// Keep both errors: attaching the hook error as `.cause` was silently
				// dropped for middy errors (they carry cause:{package}) and threw a
				// TypeError on frozen errors.
				throw new AggregateError(
					[requestError, hookErr],
					"Error thrown in requestEnd hook",
					{ cause: { package: "@middy/core" } },
				);
			}
			if (hasError) throw requestError;
		},
	);

	middy.handler = (replaceLambdaHandler) => {
		lambdaHandler = replaceLambdaHandler;
		return middy;
	};
	return middy;
};

// #1189 Streams the string body directly into the AWS Lambda response stream,
// bypassing Readable.from + pipeline. One write per chunk, respecting
// backpressure via `drain`. A body up to one chunk is a single write (V8 hands
// back the same string for a whole-string substring, so nothing is copied),
// and an empty body still gets its write: the prelude is already flushed
// eagerly after HttpResponseStream.from, so it needs no special care.
const chunkSize = 16384; // 16 * 1024, matches Node.js default highWaterMark
const writeString = async (stream, body) => {
	let position = 0;
	const length = body.length;
	do {
		const next = position + chunkSize;
		const ok = stream.write(body.substring(position, next));
		position = next;
		if (!ok && position < length) {
			await once(stream, "drain");
		}
	} while (position < length);
	await endStream(stream);
};

// Binary bodies (Buffer, any TypedArray, DataView) go out as one write of a
// zero-copy Buffer view over their bytes.
const writeBinary = async (stream, body) => {
	stream.write(Buffer.from(body.buffer, body.byteOffset, body.byteLength));
	await endStream(stream);
};

const writeStream = (stream, body) => pipeline(body, stream);

// stream.end(cb) calls cb on 'finish'; cb has no arg. Separate 'error'
// listener handles any late write errors so we don't hang on failure.
const endStream = (stream) =>
	new Promise((resolve, reject) => {
		stream.once("error", reject);
		stream.end(resolve);
	});
