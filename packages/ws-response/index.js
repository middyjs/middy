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

// The default domain is documented as
// `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}`, and "If you
// use a custom domain name for your WebSocket API, remove the `stage`
// variable". Matching the `{api-id}.execute-api.{region}.` labels rather than
// the TLD keeps other partitions' default domains (e.g. `.amazonaws.com.cn`)
// on the stage path.
// https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-how-to-call-websocket-api-connections.html
const defaultDomainPattern = /^[a-z0-9]+\.execute-api\.[a-z0-9-]+\./;

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
		const { requestContext } = request.event;
		if (requestContext?.domainName) {
			awsClientOptions.endpoint ??= defaultDomainPattern.test(
				requestContext.domainName,
			)
				? `https://${requestContext.domainName}/${requestContext.stage}`
				: `https://${requestContext.domainName}`;
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
		// There is no open connection to post to on $connect ("the actual
		// connection will not be established" until the integration completes)
		// or on $disconnect ("the connection is already closed"). The handler's
		// response is left for API Gateway as-is.
		// https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-route-keys-connect-disconnect.html
		const eventType = request.event.requestContext?.eventType;
		if (eventType === "CONNECT" || eventType === "DISCONNECT") return;

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
