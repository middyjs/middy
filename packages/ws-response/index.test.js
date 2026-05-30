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

// A fake AwsClient that records how it was constructed and what it sent, so we
// can assert prefetch/per-request behavior and the exact client config used.
const makeFakeClientFactory = () => {
	const constructions = [];
	const sends = [];
	let rejectOnceWith;
	class FakeClient {
		constructor(awsClientOptions) {
			this.awsClientOptions = awsClientOptions;
			constructions.push(awsClientOptions);
		}
		async send(command) {
			sends.push(command.input);
			if (rejectOnceWith) {
				const e = rejectOnceWith;
				rejectOnceWith = undefined;
				throw e;
			}
			return { statusCode: 200 };
		}
	}
	return {
		FakeClient,
		constructions,
		sends,
		rejectNextSendWith: (e) => {
			rejectOnceWith = e;
		},
	};
};

test("It prefetches a client at init when canPrefetch and endpoint are set", async (t) => {
	const { FakeClient, constructions, sends } = makeFakeClientFactory();

	const handler = middy(() => "string").use(
		wsResponse({
			AwsClient: FakeClient,
			awsClientOptions: { endpoint: "https://example/prod" },
		}),
	);

	// Client constructed during middleware init (prefetch), before any invocation.
	strictEqual(constructions.length, 1);

	const event = {
		requestContext: {
			domainName: "d.example.com",
			stage: "production",
			connectionId: "conn-pre",
		},
	};
	await handler(event, defaultContext);

	// Still only one construction: the prefetched client is reused, not re-created.
	strictEqual(constructions.length, 1);
	strictEqual(sends.length, 1);
});

test("It does NOT prefetch when no endpoint configured (per-request client built)", async (t) => {
	const { FakeClient, constructions } = makeFakeClientFactory();

	const handler = middy(() => "string").use(
		wsResponse({ AwsClient: FakeClient }),
	);

	// No endpoint -> no prefetch at init.
	strictEqual(constructions.length, 0);

	const event = {
		requestContext: {
			domainName: "d.example.com",
			stage: "production",
			connectionId: "conn-1",
		},
	};
	await handler(event, defaultContext);

	// Client built per-request inside after().
	strictEqual(constructions.length, 1);
});

test("It does NOT prefetch when disablePrefetch is true (default-false guard)", async (t) => {
	const { FakeClient, constructions } = makeFakeClientFactory();

	const handler = middy(() => "string").use(
		wsResponse({
			AwsClient: FakeClient,
			awsClientOptions: { endpoint: "https://example/prod" },
			disablePrefetch: true,
		}),
	);

	// canPrefetch is false even though endpoint is set -> no prefetch.
	strictEqual(constructions.length, 0);

	const event = {
		requestContext: { connectionId: "conn-x" },
	};
	await handler(event, defaultContext);

	strictEqual(constructions.length, 1);
});

test("It carries configured awsClientOptions into the per-request client", async (t) => {
	const { FakeClient, constructions } = makeFakeClientFactory();

	const handler = middy(() => "string").use(
		wsResponse({
			AwsClient: FakeClient,
			awsClientOptions: { region: "ca-central-1" },
		}),
	);

	const event = {
		requestContext: {
			domainName: "d.example.com",
			stage: "production",
			connectionId: "conn-1",
		},
	};
	await handler(event, defaultContext);

	strictEqual(constructions.length, 1);
	// Configured option preserved on the per-request client config.
	strictEqual(constructions[0].region, "ca-central-1");
	// Endpoint derived from requestContext domainName/stage.
	strictEqual(constructions[0].endpoint, "https://d.example.com/production");
});

test("It does not derive an endpoint when requestContext is absent", async (t) => {
	const { FakeClient, constructions } = makeFakeClientFactory();

	const handler = middy(() => ({
		Data: "d",
		ConnectionId: "conn-1",
	})).use(wsResponse({ AwsClient: FakeClient }));

	// No requestContext: ConnectionId comes from the response, no endpoint derived.
	const response = await handler({}, defaultContext);

	strictEqual(constructions.length, 1);
	strictEqual(constructions[0].endpoint, undefined);
	deepStrictEqual(response, { statusCode: 200 });
});

test("It exercises the InvalidSignatureException retry via the configured client", async (t) => {
	const { FakeClient, sends, rejectNextSendWith } = makeFakeClientFactory();
	const invalidSignatureError = new Error("InvalidSignatureException");
	invalidSignatureError.__type = "InvalidSignatureException";
	rejectNextSendWith(invalidSignatureError);

	const handler = middy(() => "string").use(
		wsResponse({ AwsClient: FakeClient }),
	);

	const event = {
		requestContext: {
			domainName: "d.example.com",
			stage: "production",
			connectionId: "conn-retry",
		},
	};
	const response = await handler(event, defaultContext);

	// The send was retried (called twice) after the InvalidSignatureException.
	strictEqual(sends.length, 2);
	deepStrictEqual(response, { statusCode: 200 });
});

test("It JSON.stringifies a plain object response into Data", async (t) => {
	const client = mockClient(ApiGatewayManagementApiClient);
	let sentInput;
	client.on(PostToConnectionCommand).callsFake(async (input) => {
		sentInput = input;
		return { statusCode: 200 };
	});

	const handler = middy(() => ({ foo: "bar" })).use(
		wsResponse({ AwsClient: ApiGatewayManagementApiClient }),
	);

	const event = {
		requestContext: {
			domainName: "d.example.com",
			stage: "production",
			connectionId: "conn-obj",
		},
	};
	await handler(event, defaultContext);

	strictEqual(sentInput.Data, JSON.stringify({ foo: "bar" }));
	strictEqual(sentInput.ConnectionId, "conn-obj");
});

test("It wraps a plain string with a ConnectionId-less requestContext", async (t) => {
	const client = mockClient(ApiGatewayManagementApiClient);
	let sentInput;
	client.on(PostToConnectionCommand).callsFake(async (input) => {
		sentInput = input;
		return { statusCode: 200 };
	});

	// A response with a `Data` field but no ConnectionId should NOT be re-wrapped.
	const handler = middy(() => ({ Data: "raw" })).use(
		wsResponse({ AwsClient: ApiGatewayManagementApiClient }),
	);

	const event = {
		requestContext: {
			domainName: "d.example.com",
			stage: "production",
			connectionId: "conn-data",
		},
	};
	await handler(event, defaultContext);

	// Left unwrapped: Data stays "raw" (not wrapped into { Data: { Data: "raw" } }).
	strictEqual(sentInput.Data, "raw");
	strictEqual(sentInput.ConnectionId, "conn-data");
});

test("It handles a null response by wrapping JSON.stringify(null) as Data", async (t) => {
	const client = mockClient(ApiGatewayManagementApiClient);
	let sentInput;
	client.on(PostToConnectionCommand).callsFake(async (input) => {
		sentInput = input;
		return { statusCode: 200 };
	});

	// A null response is a non-object value reaching the Data/ConnectionId checks;
	// optional chaining (response?.Data / response?.ConnectionId) must guard the
	// property access so it does not throw, and null is JSON.stringify'd to "null".
	const handler = middy(() => null).use(
		wsResponse({ AwsClient: ApiGatewayManagementApiClient }),
	);

	const event = {
		requestContext: {
			domainName: "d.example.com",
			stage: "production",
			connectionId: "conn-null",
		},
	};
	const response = await handler(event, defaultContext);

	strictEqual(sentInput.Data, "null");
	strictEqual(sentInput.ConnectionId, "conn-null");
	deepStrictEqual(response, { statusCode: 200 });
});

test("It leaves a response carrying only ConnectionId unwrapped", async (t) => {
	const client = mockClient(ApiGatewayManagementApiClient);
	let sentInput;
	client.on(PostToConnectionCommand).callsFake(async (input) => {
		sentInput = input;
		return { statusCode: 200 };
	});

	// Response already has a ConnectionId (but no Data): it must NOT be re-wrapped
	// into { Data: JSON.stringify(response) }. No Data key should appear.
	const handler = middy(() => ({ ConnectionId: "explicit-conn" })).use(
		wsResponse({ AwsClient: ApiGatewayManagementApiClient }),
	);

	const event = {
		requestContext: {
			domainName: "d.example.com",
			stage: "production",
			connectionId: "ignored",
		},
	};
	await handler(event, defaultContext);

	strictEqual(sentInput.ConnectionId, "explicit-conn");
	strictEqual(Object.hasOwn(sentInput, "Data"), false);
});

test("It normalizes an undefined response to {} when a connectionId exists", async (t) => {
	const client = mockClient(ApiGatewayManagementApiClient);
	let sentInput;
	let called = false;
	client.on(PostToConnectionCommand).callsFake(async (input) => {
		sentInput = input;
		called = true;
		return { statusCode: 200 };
	});

	// Handler returns undefined but the event carries a connectionId, so the
	// undefined response is normalized to {} and ConnectionId is injected.
	const handler = middy(() => undefined).use(
		wsResponse({ AwsClient: ApiGatewayManagementApiClient }),
	);

	const event = {
		requestContext: {
			domainName: "d.example.com",
			stage: "production",
			connectionId: "conn-undef",
		},
	};
	const response = await handler(event, defaultContext);

	ok(called);
	strictEqual(sentInput.ConnectionId, "conn-undef");
	// An undefined response is normalized to {} (no Data key at all), NOT wrapped
	// into { Data: JSON.stringify(undefined) }. The Data property must be absent.
	strictEqual(Object.hasOwn(sentInput, "Data"), false);
	deepStrictEqual(response, { statusCode: 200 });
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

test("wsResponseValidateOptions rejects a non-function AwsClient (constraint enforced)", () => {
	// valid: a function passes the instanceof Function constraint.
	wsResponseValidateOptions({ AwsClient: () => {} });
	try {
		wsResponseValidateOptions({ AwsClient: 123 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("AwsClient"));
	}
});

test("wsResponseValidateOptions rejects a non-object awsClientOptions", () => {
	wsResponseValidateOptions({ awsClientOptions: { region: "x" } });
	try {
		wsResponseValidateOptions({ awsClientOptions: "not-an-object" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("awsClientOptions"));
	}
});

test("wsResponseValidateOptions rejects a non-string awsClientAssumeRole", () => {
	wsResponseValidateOptions({ awsClientAssumeRole: "role-arn" });
	try {
		wsResponseValidateOptions({ awsClientAssumeRole: 123 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("awsClientAssumeRole"));
	}
});

test("wsResponseValidateOptions rejects a non-function awsClientCapture", () => {
	wsResponseValidateOptions({ awsClientCapture: () => {} });
	try {
		wsResponseValidateOptions({ awsClientCapture: "not-a-function" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("awsClientCapture"));
	}
});
