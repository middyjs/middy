// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	ApiGatewayManagementApiClient,
	PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

import {
	canPrefetch,
	catchInvalidSignatureException,
	createClientInit,
	createPrefetchClient,
	validateOptions,
} from "@middy/util";

const name = "ws-response";
const pkg = `@middy/${name}`;

const optionSchema = {
	type: "object",
	properties: {
		AwsClient: { instanceof: "Function" },
		awsClientOptions: { type: "object" },
		awsClientAssumeRole: { type: "string" },
		awsClientCapture: { instanceof: "Function" },
		disablePrefetch: { type: "boolean" },
	},
	additionalProperties: false,
};

export const wsResponseValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const defaults = {
	AwsClient: ApiGatewayManagementApiClient,
	awsClientOptions: {}, // { endpoint }
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	disablePrefetch: false,
};

const wsResponseMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	let client;
	if (canPrefetch(options) && options.awsClientOptions.endpoint) {
		client = createPrefetchClient(options);
	}

	// Clients built from `event.requestContext` are keyed by endpoint so a
	// function served through several stages or custom domains posts to the
	// endpoint the request arrived on, instead of the first one the container
	// saw. Bounded so an unbounded set of domains cannot grow memory. Each
	// endpoint keeps its own util client init, which rebuilds the client when
	// sts refetches the `awsClientAssumeRole` credentials and forgets a
	// rejected init so the next invocation retries.
	const derivedClients = new Map(); // endpoint -> { init, client }
	const derivedClientsMax = 8;

	const resolveClient = async (request) => {
		if (client) return client;
		// Build a per-request client config without mutating the shared options
		// object (which would otherwise leak one request's endpoint to later
		// warm invocations).
		const awsClientOptions = { ...options.awsClientOptions };
		if (request.event.requestContext) {
			awsClientOptions.endpoint ??= `https://${request.event.requestContext.domainName}/${request.event.requestContext.stage}`;
		}
		const { endpoint } = awsClientOptions;
		const derived = derivedClients.get(endpoint) ?? {
			init: createClientInit({ ...options, awsClientOptions }),
		};
		derived.client = await derived.init(request);
		// Only a resolved client is memoized, so a rejected init never counts
		// against the bound; on a hit this re-sets the same entry.
		derivedClients.set(endpoint, derived);
		if (derivedClients.size > derivedClientsMax) {
			const [oldestEndpoint, oldest] = derivedClients.entries().next().value;
			derivedClients.delete(oldestEndpoint);
			// Release the evicted client's keep-alive sockets.
			oldest.client.destroy?.();
		}
		return derived.client;
	};

	const wsResponseMiddlewareAfter = async (request) => {
		const normalizedResponse = normalizeWsResponse(request);

		if (!normalizedResponse.ConnectionId) return;

		const requestClient = await resolveClient(request);

		const command = new PostToConnectionCommand(normalizedResponse);
		try {
			await requestClient
				.send(command)
				.catch((e) =>
					catchInvalidSignatureException(e, requestClient, command),
				);
		} catch (e) {
			// The client already disconnected. Nothing can be delivered, but that
			// is not a failure of this invocation.
			if (e.name !== "GoneException") throw e;
			request.response = { statusCode: 410 };
			return;
		}

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
		const data =
			typeof response === "string" || response instanceof Uint8Array
				? response
				: JSON.stringify(response);
		response = { Data: data };
	}
	response.ConnectionId ??= request.event.requestContext?.connectionId;
	return response;
};

export default wsResponseMiddleware;
