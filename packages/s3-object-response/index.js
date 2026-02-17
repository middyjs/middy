// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import {
	canPrefetch,
	createClient,
	createPrefetchClient,
	// catchInvalidSignatureException
} from "@middy/util";

const defaults = {
	AwsClient: S3Client,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	disablePrefetch: false,
};

const s3ObjectResponseMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	let client;
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
	}

	const s3ObjectResponseMiddlewareBefore = async (request) => {
		const { inputS3Url } = request.event.getObjectContext ?? {};

		request.context.s3ObjectFetch = inputS3Url ? fetch(inputS3Url) : undefined;
	};

	const s3ObjectResponseMiddlewareAfter = async (request) => {
		if (!client) {
			client = await createClient(options, request);
		}

		const command = new WriteGetObjectResponseCommand({
			RequestRoute: request.event.getObjectContext?.outputRoute,
			RequestToken: request.event.getObjectContext?.outputToken,
			Body: request.response.Body ?? request.response.body,
		});
		await client.send(command); // Doesn't return a promise?
		// .catch((e) => catchInvalidSignatureException(e, client, command))

		return { statusCode: 200 };
	};

	return {
		before: s3ObjectResponseMiddlewareBefore,
		after: s3ObjectResponseMiddlewareAfter,
	};
};

export default s3ObjectResponseMiddleware;

// used for TS type inference (see index.d.ts)
export function s3ObjectResponseParam(name) {
	return name;
}
