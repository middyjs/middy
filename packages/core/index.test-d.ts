import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Handler as AWSLambdaHandler,
	Context,
	S3Event,
} from "aws-lambda";
import { expect } from "tstyche";
import middy, {
	type MiddyfiedHandler,
	type PluginExecutionMode,
} from "./index.js";

const executionModeStreamifyResponse: PluginExecutionMode =
	{} as PluginExecutionMode;

// extends Handler type from aws-lambda
type EnhanceHandlerType<T, NewReturn> = T extends (
	event: infer TEvent,
	context: infer TContextType,
	opts: infer TOptsType,
) => infer R
	? (event: TEvent, context: TContextType, opts: TOptsType) => R | NewReturn
	: never;

type AWSLambdaHandlerWithoutCallback<TEvent = any, TResult = any> = (
	event: TEvent,
	context: Context,
) => undefined | Promise<TResult>;

type LambdaHandler<TEvent = any, TResult = any> = EnhanceHandlerType<
	AWSLambdaHandlerWithoutCallback<TEvent, TResult>,
	TResult
>;

const lambdaHandler: LambdaHandler<
	APIGatewayProxyEvent,
	APIGatewayProxyResult
> = async (event) => {
	return {
		statusCode: 200,
		body: `Hello from ${event.path}`,
	};
};

type Handler = middy.MiddyfiedHandler<
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Error
>;
type Request = middy.Request<
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Error,
	Context
>;

// initialize
let handler = middy(lambdaHandler);
expect(handler).type.toBe<Handler>();

// initialize with empty plugin
handler = middy(lambdaHandler, {});
expect(handler).type.toBe<Handler>();

// initialize with plugin with few hooks
handler = middy(lambdaHandler, {
	beforePrefetch() {
		console.log("beforePrefetch");
	},
});
expect(handler).type.toBe<Handler>();

// initialize with plugin with all hooks
handler = middy(lambdaHandler, {
	beforePrefetch() {
		console.log("beforePrefetch");
	},
	requestStart() {
		console.log("requestStart");
	},
	beforeMiddleware(name: string) {
		console.log("beforeMiddleware", name);
	},
	afterMiddleware(name: string) {
		console.log("afterMiddleware", name);
	},
	beforeHandler() {
		console.log("beforeHandler");
	},
	afterHandler() {
		console.log("afterHandler");
	},
	async requestEnd() {
		console.log("requestEnd");
	},
});
expect(handler).type.toBe<Handler>();

// middy wrapped handler should be assignable to aws-lambda handler type.
expect(handler).type.toBeAssignableTo<
	AWSLambdaHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
>();

// Middy handlers third argument is an object containing a abort signal
middy((event: any, context: any, { signal }: { signal: AbortSignal }) =>
	expect(signal).type.toBe<AbortSignal>(),
);

// invokes the handler to test that it is callable
async function invokeHandler(): Promise<undefined | APIGatewayProxyResult> {
	const sampleEvent: APIGatewayProxyEvent = {
		resource: "/",
		path: "/",
		httpMethod: "GET",
		requestContext: {
			resourcePath: "/",
			httpMethod: "GET",
			path: "/Prod/",
			accountId: "x",
			apiId: "y",
			authorizer: {},
			protocol: "p",
			identity: {
				accessKey: "",
				accountId: "",
				apiKey: "",
				apiKeyId: "",
				caller: "",
				clientCert: null,
				cognitoAuthenticationProvider: "",
				cognitoAuthenticationType: "",
				cognitoIdentityId: "",
				cognitoIdentityPoolId: "",
				principalOrgId: "",
				sourceIp: "",
				user: "",
				userAgent: "",
				userArn: "",
				vpceId: "",
				vpcId: "",
			},
			stage: "",
			requestId: "",
			requestTimeEpoch: 12345567,
			resourceId: "",
		},
		headers: {
			accept:
				"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
			"accept-encoding": "gzip, deflate, br",
			Host: "70ixmpl4fl.execute-api.us-east-2.amazonaws.com",
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
			"X-Amzn-Trace-Id": "Root=1-5e66d96f-7491f09xmpl79d18acf3d050",
		},
		multiValueHeaders: {
			accept: [
				"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
			],
			"accept-encoding": ["gzip, deflate, br"],
		},
		queryStringParameters: null,
		multiValueQueryStringParameters: null,
		pathParameters: null,
		stageVariables: null,
		body: null,
		isBase64Encoded: false,
	};
	const sampleContext: Context = {
		callbackWaitsForEmptyEventLoop: true,
		functionName: "",
		functionVersion: "",
		invokedFunctionArn: "",
		memoryLimitInMB: "234",
		awsRequestId: "",
		logGroupName: "",
		logStreamName: "",
		getRemainingTimeInMillis: (): number => 1,
		done: () => {},
		fail: (_) => {},
		succeed: () => {},
	};
	return await handler(sampleEvent, sampleContext);
}
invokeHandler().catch(console.error);

const middlewareObj = {
	before: (request: Request) => {
		console.log("Before", request);
	},
	after: (request: Request) => {
		console.log("After", request);
	},
	onError: (request: Request) => {
		console.log("OnError", request);
	},
};

// use with 1 middleware
handler = handler.use(middlewareObj);
expect(handler).type.toBe<Handler>();

// use with array of middlewares
handler = handler.use([middlewareObj]);
expect(handler).type.toBe<Handler>();

// before
handler = handler.before((request: Request) => {
	console.log("Before", request);
});
expect(handler).type.toBe<Handler>();

// after
handler = handler.after((request: Request) => {
	console.log("After", request);
});
expect(handler).type.toBe<Handler>();

// error
handler = handler.onError((request: Request) => {
	console.log("OnError", request);
});
expect(handler).type.toBe<Handler>();

interface MutableContext extends Context {
	name: string;
}

type MutableContextHandler = middy.MiddyfiedHandler<
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Error,
	MutableContext
>;
type MutableContextRequest = middy.Request<
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Error,
	MutableContext
>;

async function mutableContextDependantHandler(
	event: APIGatewayProxyEvent,
	context: MutableContext,
): Promise<APIGatewayProxyResult> {
	return {
		statusCode: 200,
		body: `Hello from ${context.name}`,
	};
}

let customCtxHandler = middy<
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Error,
	MutableContext
>(mutableContextDependantHandler);
expect(customCtxHandler).type.toBe<MutableContextHandler>();

expect(
	middy<APIGatewayProxyEvent, APIGatewayProxyResult, Error, Context>,
).type.not.toBeCallableWith(mutableContextDependantHandler);

const mutableContextMiddleware = {
	before: (request: MutableContextRequest) => {
		request.context.name = "Foo";
	},
};

customCtxHandler = customCtxHandler.use(mutableContextMiddleware);
expect(customCtxHandler).type.toBe<MutableContextHandler>();

const typeErrorMiddleware = {
	before: (request: MutableContextRequest) => {
		// @ts-expect-error!
		request.context.test = "Bar";
	},
};

customCtxHandler = customCtxHandler.use(typeErrorMiddleware);
expect(customCtxHandler).type.toBe<MutableContextHandler>();

const streamifiedResponseHandler = middy<APIGatewayProxyEvent>({
	executionMode: executionModeStreamifyResponse,
});
expect(streamifiedResponseHandler).type.toBe<
	middy.MiddyfiedHandler<APIGatewayProxyEvent>
>();

streamifiedResponseHandler.handler(lambdaHandler);
streamifiedResponseHandler.use(middlewareObj);

// synced handler
const syncedLambdaHandler: LambdaHandler<
	APIGatewayProxyEvent,
	APIGatewayProxyResult
> = (event) => {
	return {
		statusCode: 200,
		body: `Hello from ${event.path}`,
	};
};

// initialize
let syncedHandler = middy(syncedLambdaHandler);
expect(syncedHandler).type.toBe<Handler>();

// initialize with empty plugin
syncedHandler = middy(syncedLambdaHandler, {});
expect(syncedHandler).type.toBe<Handler>();

// initialize with plugin with few hooks
syncedHandler = middy(syncedLambdaHandler, {
	beforePrefetch() {
		console.log("beforePrefetch");
	},
});
expect(syncedHandler).type.toBe<Handler>();

// initialize with plugin with all hooks
syncedHandler = middy(syncedLambdaHandler, {
	beforePrefetch() {
		console.log("beforePrefetch");
	},
	requestStart() {
		console.log("requestStart");
	},
	beforeMiddleware(name: string) {
		console.log("beforeMiddleware", name);
	},
	afterMiddleware(name: string) {
		console.log("afterMiddleware", name);
	},
	beforeHandler() {
		console.log("beforeHandler");
	},
	afterHandler() {
		console.log("afterHandler");
	},
	async requestEnd() {
		console.log("requestEnd");
	},
});
expect(syncedHandler).type.toBe<Handler>();

// invokes the handler to test that it is callable
async function invokeSyncedHandler(): Promise<
	undefined | APIGatewayProxyResult
> {
	const sampleEvent: APIGatewayProxyEvent = {
		resource: "/",
		path: "/",
		httpMethod: "GET",
		requestContext: {
			resourcePath: "/",
			httpMethod: "GET",
			path: "/Prod/",
			accountId: "x",
			apiId: "y",
			authorizer: {},
			protocol: "p",
			identity: {
				accessKey: "",
				accountId: "",
				apiKey: "",
				apiKeyId: "",
				caller: "",
				clientCert: null,
				cognitoAuthenticationProvider: "",
				cognitoAuthenticationType: "",
				cognitoIdentityId: "",
				cognitoIdentityPoolId: "",
				principalOrgId: "",
				sourceIp: "",
				user: "",
				userAgent: "",
				userArn: "",
				vpceId: "",
				vpcId: "",
			},
			stage: "",
			requestId: "",
			requestTimeEpoch: 12345567,
			resourceId: "",
		},
		headers: {
			accept:
				"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
			"accept-encoding": "gzip, deflate, br",
			Host: "70ixmpl4fl.execute-api.us-east-2.amazonaws.com",
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
			"X-Amzn-Trace-Id": "Root=1-5e66d96f-7491f09xmpl79d18acf3d050",
		},
		multiValueHeaders: {
			accept: [
				"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
			],
			"accept-encoding": ["gzip, deflate, br"],
		},
		queryStringParameters: null,
		multiValueQueryStringParameters: null,
		pathParameters: null,
		stageVariables: null,
		body: null,
		isBase64Encoded: false,
	};
	const sampleContext: Context = {
		callbackWaitsForEmptyEventLoop: true,
		functionName: "",
		functionVersion: "",
		invokedFunctionArn: "",
		memoryLimitInMB: "234",
		awsRequestId: "",
		logGroupName: "",
		logStreamName: "",
		getRemainingTimeInMillis: (): number => 1,
		done: () => {},
		fail: (_) => {},
		succeed: () => {},
	};
	return await syncedHandler(sampleEvent, sampleContext);
}
invokeSyncedHandler().catch(console.error);

// use with 1 middleware
syncedHandler = syncedHandler.use(middlewareObj);
expect(syncedHandler).type.toBe<Handler>();

// use with array of middlewares
syncedHandler = syncedHandler.use([middlewareObj]);
expect(syncedHandler).type.toBe<Handler>();

// before
syncedHandler = syncedHandler.before((request: Request) => {
	console.log("Before", request);
});
expect(syncedHandler).type.toBe<Handler>();

// after
syncedHandler = syncedHandler.after((request: Request) => {
	console.log("After", request);
});
expect(syncedHandler).type.toBe<Handler>();

// error
syncedHandler = syncedHandler.onError((request: Request) => {
	console.log("OnError", request);
});
expect(syncedHandler).type.toBe<Handler>();

interface MutableContext extends Context {
	name: string;
}

function syncedMutableContextDependantHandler(
	event: APIGatewayProxyEvent,
	context: MutableContext,
): APIGatewayProxyResult {
	return {
		statusCode: 200,
		body: `Hello from ${context.name}`,
	};
}

let customSyncedCtxHandler = middy<
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Error,
	MutableContext
>(syncedMutableContextDependantHandler);
expect(customSyncedCtxHandler).type.toBe<MutableContextHandler>();

expect(
	middy<APIGatewayProxyEvent, APIGatewayProxyResult, Error, Context>,
).type.not.toBeCallableWith(syncedMutableContextDependantHandler);

const mutableSyncedContextMiddleware = {
	before: (request: MutableContextRequest) => {
		request.context.name = "Foo";
	},
};

customSyncedCtxHandler = customSyncedCtxHandler.use(
	mutableSyncedContextMiddleware,
);
expect(customSyncedCtxHandler).type.toBe<MutableContextHandler>();

const syncedTypeErrorMiddleware = {
	before: (request: MutableContextRequest) => {
		// @ts-expect-error!
		request.context.test = "Bar";
	},
};

customSyncedCtxHandler = customSyncedCtxHandler.use(syncedTypeErrorMiddleware);
expect(customSyncedCtxHandler).type.toBe<MutableContextHandler>();

const syncedStreamifiedResponseHandler = middy<APIGatewayProxyEvent>({
	executionMode: executionModeStreamifyResponse,
});
expect(syncedStreamifiedResponseHandler).type.toBe<
	middy.MiddyfiedHandler<APIGatewayProxyEvent>
>();

syncedStreamifiedResponseHandler.handler(syncedLambdaHandler);
syncedStreamifiedResponseHandler.use(middlewareObj);

// Issue #1176
const baseHandler: AWSLambdaHandler = async (event) => {
	console.log("Hello world");
};

const handler1176 = middy(baseHandler);
expect(handler1176).type.toBe<MiddyfiedHandler<any, any, Error, Context, {}>>();

// Issue #1182
const s3Handler = async (event: S3Event): Promise<undefined> => {
	await Promise.all(event.Records.map(async () => await Promise.resolve()));
};

const handler1182 = middy<S3Event>().handler(s3Handler);
expect(handler1182).type.toBe<
	MiddyfiedHandler<S3Event, any, Error, Context, {}>
>();

//  Issue #1228 Correct return type
const numberHandler = middy<APIGatewayProxyEvent, number>().handler(
	async (event) => {
		return 42; // Correct return type, should pass type checking
	},
);
expect(numberHandler).type.toBe<
	middy.MiddyfiedHandler<APIGatewayProxyEvent, number>
>();

//  Issue #1228 Incorrect return type
const invalidNumberHandler = middy<APIGatewayProxyEvent, number>()
	// @ts-expect-error!
	.handler(async () => {
		return "not a number";
	});
expect(invalidNumberHandler).type.toBe<
	middy.MiddyfiedHandler<APIGatewayProxyEvent, number>
>();

// Issue #1275 Early Response type
middy<unknown, string>()
	.before(async (request) => {
		request.earlyResponse = "Hello, world!";
	})
	.use({
		after: (request) => {
			request.earlyResponse = null;
		},
	})
	.onError(async (request) => {
		request.earlyResponse = undefined;
	});

//  Issue #1293 Handler event type is not correctly inferred
// @ts-expect-error!
const s3MiddyHandler = middy().handler(s3Handler);
expect(s3MiddyHandler).type.toBe<middy.MiddyfiedHandler<unknown, any>>();

// Issue #1289 .use() does not intersect Typescript types appropriately for an array of middleware
const middleware1 = { before: (req: middy.Request<{ foo: string }>) => {} };
const middleware2 = { before: (req: middy.Request<{ bar: string }>) => {} };
const handlerWithCombinedEvent = middy(lambdaHandler).use([
	middleware1,
	middleware2,
]);
expect(handlerWithCombinedEvent).type.toBe<
	middy.MiddyfiedHandler<
		APIGatewayProxyEvent & { foo: string } & { bar: string },
		APIGatewayProxyResult
	>
>();
