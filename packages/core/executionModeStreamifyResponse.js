// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
/* global awslambda */
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
			const handlerResponse = await runRequest(
				request,
				beforeMiddlewares,
				lambdaHandler,
				afterMiddlewares,
				onErrorMiddlewares,
				plugin,
			);
			let responseStream = lambdaResponseStream;
			let handlerBody = handlerResponse ?? "";
			if (handlerResponse?.statusCode) {
				const { body, ...restResponse } = handlerResponse;
				handlerBody = body ?? ""; // #1137
				responseStream = awslambda.HttpResponseStream.from(
					responseStream,
					restResponse,
				);
				responseStream.write("");
			}

			// See executionModeStandard for the .cause-chaining rationale.
			let handlerError;
			try {
				if (typeof handlerBody === "string") {
					await writeString(responseStream, handlerBody);
				} else if (
					handlerBody._readableState ||
					handlerBody instanceof ReadableStream
				) {
					await pipeline(handlerBody, responseStream);
				} else {
					throw new Error("handler response not a Readable or ReadableStream", {
						cause: { package: "@middy/core" },
					});
				}
			} catch (err) {
				handlerError = err;
			}
			try {
				const requestEndResult = plugin.requestEnd(request);
				if (requestEndResult instanceof Promise) await requestEndResult;
			} catch (hookErr) {
				if (handlerError) {
					handlerError.cause ??= hookErr;
				} else {
					throw hookErr;
				}
			}
			if (handlerError) throw handlerError;
		},
	);

	middy.handler = (replaceLambdaHandler) => {
		lambdaHandler = replaceLambdaHandler;
		return middy;
	};
	return middy;
};

// #1189 Streams the string body directly into the AWS Lambda response stream,
// bypassing Readable.from + pipeline. For sub-chunk strings this is a single
// write+end; for larger strings we slice and respect backpressure via `drain`.
const chunkSize = 16384; // 16 * 1024, matches Node.js default highWaterMark
const writeString = async (stream, body) => {
	// Stryker disable next-line EqualityOperator: at body.length === chunkSize both branches emit one identical full-body write then end(); behavior is indistinguishable.
	if (body.length <= chunkSize) {
		// Single-shot: write then end(). The prelude is already flushed eagerly
		// after HttpResponseStream.from, so an empty body needs no special care.
		stream.write(body);
	} else {
		let position = 0;
		const length = body.length;
		while (position < length) {
			const next = position + chunkSize;
			const ok = stream.write(body.substring(position, next));
			position = next;
			if (!ok && position < length) {
				await once(stream, "drain");
			}
		}
	}
	// stream.end(cb) calls cb on 'finish'; cb has no arg. Separate 'error'
	// listener handles any late write errors so we don't hang on failure.
	await new Promise((resolve, reject) => {
		stream.once("error", reject);
		stream.end(resolve);
	});
};
