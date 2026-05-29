import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";

import {
	ApiGatewayManagementApiClient,
	PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";

import wsResponse, { wsResponseValidateOptions } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should post when api gateway event", async (t) => {
	mockClient(ApiGatewayManagementApiClient)
		.on(PostToConnectionCommand)
		.resolves({ statusCode: 200 });

	const handler = middy((event, context) => {
		return "string";
	});

	handler.use(
		wsResponse({
			AwsClient: ApiGatewayManagementApiClient,
		}),
	);

	const event = {
		requestContext: {
			domainName: "xxxxxx.execute-api.region.amazonaws.com",
			stage: "production",
			connectionId: "id",
		},
	};
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { statusCode: 200 });
});

test("It should post when endpoint option set", async (t) => {
	mockClient(ApiGatewayManagementApiClient)
		.on(PostToConnectionCommand)
		.resolves({ statusCode: 200 });

	const handler = middy((event, context) => {
		return {
			ConnectionId: "ConnectionId",
			Data: "",
		};
	});

	handler.use(
		wsResponse({
			AwsClient: ApiGatewayManagementApiClient,
			awsClientOptions: {
				endpoint: "xxxxxx.execute-api.region.amazonaws.com/production",
			},
		}),
	);

	const event = {};
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { statusCode: 200 });
});

test("It should not post when connection id is not set", async (t) => {
	mockClient(ApiGatewayManagementApiClient)
		.on(PostToConnectionCommand)
		.resolves({ statusCode: 200 });

	const handler = middy((event, context) => {
		return true;
	});

	handler.use(
		wsResponse({
			AwsClient: ApiGatewayManagementApiClient,
		}),
	);

	const event = {};
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, true);
});

test("It should not post when response not set", async (t) => {
	mockClient(ApiGatewayManagementApiClient)
		.on(PostToConnectionCommand)
		.resolves({ statusCode: 200 });

	const handler = middy((event, context) => {});

	handler.use(
		wsResponse({
			AwsClient: ApiGatewayManagementApiClient,
		}),
	);

	const event = {};
	const response = await handler(event, defaultContext);

	deepStrictEqual(response, undefined);
});

test("It should handle InvalidSignatureException and retry", async (t) => {
	const client = mockClient(ApiGatewayManagementApiClient);
	const invalidSignatureError = new Error("InvalidSignatureException");
	invalidSignatureError.__type = "InvalidSignatureException";

	client
		.on(PostToConnectionCommand)
		.rejectsOnce(invalidSignatureError)
		.resolves({ statusCode: 200 });

	const handler = middy((event, context) => {
		return "string";
	});

	handler.use(
		wsResponse({
			AwsClient: ApiGatewayManagementApiClient,
		}),
	);

	const event = {
		requestContext: {
			domainName: "xxxxxx.execute-api.region.amazonaws.com",
			stage: "production",
			connectionId: "id",
		},
	};
	const response = await handler(event, defaultContext);
	deepStrictEqual(response, { statusCode: 200 });
});

test("It should wrap a scalar response as Data and inject connectionId", async (t) => {
	const client = mockClient(ApiGatewayManagementApiClient);
	let sentInput;
	client.on(PostToConnectionCommand).callsFake(async (input) => {
		sentInput = input;
		return { statusCode: 200 };
	});

	const handler = middy(() => "payload-string").use(
		wsResponse({ AwsClient: ApiGatewayManagementApiClient }),
	);

	const event = {
		requestContext: {
			domainName: "xxxxxx.execute-api.region.amazonaws.com",
			stage: "production",
			connectionId: "conn-1",
		},
	};
	await handler(event, defaultContext);

	strictEqual(sentInput.Data, "payload-string");
	strictEqual(sentInput.ConnectionId, "conn-1");
});

test("It should respect a pre-shaped { Data, ConnectionId } response", async (t) => {
	const client = mockClient(ApiGatewayManagementApiClient);
	let sentInput;
	client.on(PostToConnectionCommand).callsFake(async (input) => {
		sentInput = input;
		return { statusCode: 200 };
	});

	const handler = middy(() => ({
		Data: "explicit-data",
		ConnectionId: "explicit-conn",
	})).use(
		wsResponse({
			AwsClient: ApiGatewayManagementApiClient,
			awsClientOptions: { endpoint: "https://example/prod" },
		}),
	);

	await handler({}, defaultContext);

	strictEqual(sentInput.Data, "explicit-data");
	strictEqual(sentInput.ConnectionId, "explicit-conn");
});

test("It should not write a derived endpoint back onto the shared awsClientOptions", async (t) => {
	mockClient(ApiGatewayManagementApiClient)
		.on(PostToConnectionCommand)
		.resolves({ statusCode: 200 });

	// No explicit endpoint: it is derived from requestContext. The derived value
	// must live on a per-request copy, not leak back onto the shared options
	// object (which would poison later warm-container invocations).
	const awsClientOptions = {};
	const handler = middy(() => "string").use(
		wsResponse({ AwsClient: ApiGatewayManagementApiClient, awsClientOptions }),
	);

	const event = {
		requestContext: {
			domainName: "xxxxxx.execute-api.region.amazonaws.com",
			stage: "production",
			connectionId: "id",
		},
	};
	const response = await handler(event, defaultContext);

	deepStrictEqual(response, { statusCode: 200 });
	strictEqual(awsClientOptions.endpoint, undefined);
});

test("It should preserve an explicit endpoint over the requestContext-derived one", async (t) => {
	mockClient(ApiGatewayManagementApiClient)
		.on(PostToConnectionCommand)
		.resolves({ statusCode: 200 });

	const awsClientOptions = { endpoint: "https://option-endpoint/prod" };
	const handler = middy(() => "string").use(
		wsResponse({ AwsClient: ApiGatewayManagementApiClient, awsClientOptions }),
	);

	const event = {
		requestContext: {
			domainName: "xxxxxx.execute-api.region.amazonaws.com",
			stage: "production",
			connectionId: "id",
		},
	};
	const response = await handler(event, defaultContext);

	deepStrictEqual(response, { statusCode: 200 });
	// The explicit endpoint wins and the caller's object is left untouched (no
	// requestContext-derived endpoint leaked back onto the shared options).
	strictEqual(awsClientOptions.endpoint, "https://option-endpoint/prod");
});

test("It should pass a binary Uint8Array response through as Data without serializing", async (t) => {
	const client = mockClient(ApiGatewayManagementApiClient);
	let sentInput;
	client.on(PostToConnectionCommand).callsFake(async (input) => {
		sentInput = input;
		return { statusCode: 200 };
	});

	const binary = new Uint8Array([1, 2, 3]);
	const handler = middy(() => binary).use(
		wsResponse({ AwsClient: ApiGatewayManagementApiClient }),
	);

	const event = {
		requestContext: {
			domainName: "xxxxxx.execute-api.region.amazonaws.com",
			stage: "production",
			connectionId: "conn-bin",
		},
	};
	await handler(event, defaultContext);

	strictEqual(sentInput.Data, binary);
	strictEqual(sentInput.ConnectionId, "conn-bin");
});

test("wsResponseValidateOptions accepts valid options and rejects typos", () => {
	wsResponseValidateOptions({ disablePrefetch: true });
	wsResponseValidateOptions({});
	try {
		wsResponseValidateOptions({ disablePrefech: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/ws-response");
	}
});

test("wsResponseValidateOptions rejects wrong type", () => {
	try {
		wsResponseValidateOptions({ AwsClient: "not-a-class" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("AwsClient"));
	}
});
