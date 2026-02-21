// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	ApiGatewayManagementApiClient,
	PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

import {
	canPrefetch,
	catchInvalidSignatureException,
	createClient,
	createPrefetchClient,
} from "@middy/util";

const defaults = {
	AwsClient: ApiGatewayManagementApiClient,
	awsClientOptions: {}, // { endpoint }
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	disablePrefetch: false,
};

const wsResponseMiddleware = (opts) => {
	const options = { ...defaults, ...opts };

	let client;
	if (canPrefetch(options) && options.awsClientOptions.endpoint) {
		client = createPrefetchClient(options);
	}

	const wsResponseMiddlewareAfter = async (request) => {
		const normalizedResponse = normalizeWsResponse(request);

		if (!normalizedResponse.ConnectionId) return;

		if (!options.awsClientOptions.endpoint && request.event.requestContext) {
			options.awsClientOptions.endpoint = `https://${
				request.event.requestContext.domainName
			}/${request.event.requestContext.stage}`;
		}
		if (!client) {
			client = await createClient(options, request);
		}

		const command = new PostToConnectionCommand(normalizedResponse);
		await client
			.send(command)
			.catch((e) => catchInvalidSignatureException(e, client, command));

		request.response = { statusCode: 200 };
	};

	return {
		after: wsResponseMiddlewareAfter,
	};
};

const normalizeWsResponse = (request) => {
	let { response } = request;
	if (typeof response === "undefined") {
		response = {};
	} else if (
		typeof response?.Data === "undefined" &&
		typeof response?.ConnectionId === "undefined"
	) {
		response = { Data: response };
	}
	response.ConnectionId ??= request.event.requestContext?.connectionId;
	return response;
};

export default wsResponseMiddleware;
