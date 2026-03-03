// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
/* global awslambda */
import { Readable } from "node:stream";
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
			let handlerBody = handlerResponse;
			if (handlerResponse.statusCode) {
				const { body, ...restResponse } = handlerResponse;
				handlerBody = body ?? ""; // #1137
				responseStream = awslambda.HttpResponseStream.from(
					responseStream,
					restResponse,
				);
			}

			let handlerStream;
			if (handlerBody._readableState || handlerBody instanceof ReadableStream) {
				handlerStream = handlerBody;
			} else if (typeof handlerBody === "string") {
				// #1189
				handlerStream = Readable.from(
					handlerBody.length < stringIteratorSize
						? handlerBody
						: stringIterator(handlerBody),
				);
			}

			if (!handlerStream) {
				throw new Error("handler response not a Readable or ReadableStream", {
					cause: { package: "@middy/core" },
				});
			}

			await pipeline(handlerStream, responseStream);
			await plugin.requestEnd(request);
		},
	);

	middy.handler = (replaceLambdaHandler) => {
		lambdaHandler = replaceLambdaHandler;
		return middy;
	};
	return middy;
};

const stringIteratorSize = 16384; // 16 * 1024 // Node.js default
function* stringIterator(input) {
	let position = 0;
	const length = input.length;
	while (position < length) {
		yield input.substring(position, position + stringIteratorSize);
		position += stringIteratorSize;
	}
}
