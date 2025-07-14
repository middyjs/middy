import { SSMClient } from "@aws-sdk/client-ssm";
import type middy from "@middy/core";
import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context as LambdaContext,
} from "aws-lambda";
import { expectType } from "tsd";
import * as util from "./index.js";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type TInternal = {
	boolean: true;
	number: 1;
	string: "string";
	array: [];
	object: {
		key: "value";
	};
	promise: Promise<string>;
	promiseObject: Promise<{
		key: "value";
	}>;
};

const sampleRequest: middy.Request<
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Error,
	LambdaContext,
	TInternal
> = {
	event: {
		body: "",
		headers: {},
		multiValueHeaders: {},
		httpMethod: "GET",
		isBase64Encoded: false,
		path: "/foo/bar",
		pathParameters: {},
		queryStringParameters: {},
		multiValueQueryStringParameters: {},
		stageVariables: {},
		requestContext: {
			accountId: "foo",
			apiId: "bar",
			authorizer: {},
			protocol: "https",
			httpMethod: "GET",
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
			},
			requestId: "",
			requestTimeEpoch: 1234,
			resourceId: "",
			resourcePath: "",
			path: "/foo/bar",
			stage: "dev",
		},
		resource: "",
	},
	context: {
		callbackWaitsForEmptyEventLoop: true,
		functionName: "myfunction",
		functionVersion: "1.0",
		invokedFunctionArn:
			"arn:aws:lambda:us-west-2:123456789012:function:my-function",
		memoryLimitInMB: "17",
		awsRequestId: "abc22",
		logGroupName: "my-function-lg",
		logStreamName: "my-function-ls",
		getRemainingTimeInMillis: () => 22222222,
		done: () => {},
		fail: () => {},
		succeed: () => {},
	},
	response: null,
	error: null,
	internal: {
		boolean: true,
		number: 1,
		string: "string",
		array: [],
		object: {
			key: "value",
		},
		promise: Promise.resolve("promise"),
		promiseObject: Promise.resolve({
			key: "value",
		}),
	},
};

const prefetchClient = util.createPrefetchClient<SSMClient, {}>({
	AwsClient: SSMClient,
});
expectType<SSMClient>(prefetchClient);

const client = util.createClient<SSMClient, {}>(
	{ AwsClient: SSMClient },
	sampleRequest,
);
expectType<Promise<SSMClient>>(client);

const canPrefetch = util.canPrefetch<SSMClient, {}>({ AwsClient: SSMClient });
expectType<boolean>(canPrefetch);

// getInternal should get none from internal store
async function testGetInternalNone(): Promise<{}> {
	const result = await util.getInternal(false, sampleRequest);
	expectType<{}>(result);
	return result;
}
expectType<Promise<{}>>(testGetInternalNone());

// getInternal should get all from internal store
interface DeepAwaitedTInternal {
	boolean: true;
	number: 1;
	string: "string";
	array: [];
	object: {
		key: "value";
	};
	promise: string; // this was Promise<string> in TInternal;
	promiseObject: {
		// this was Promise<{key: "value"}> in TInternal
		key: "value";
	};
}
async function testGetAllInternal(): Promise<DeepAwaitedTInternal> {
	const result = await util.getInternal(true, sampleRequest);
	expectType<DeepAwaitedTInternal>(result);
	return result;
}
expectType<Promise<DeepAwaitedTInternal>>(testGetAllInternal());

// getInternal should get from internal store when string
async function testGetInternalField(): Promise<{ number: 1 }> {
	const result = await util.getInternal("number", sampleRequest);
	expectType<{ number: 1 }>(result);
	return result;
}
expectType<Promise<{ number: 1 }>>(testGetInternalField());

// getInternal should get from internal store when array[string]
async function testGetInternalFields(): Promise<{
	boolean: true;
	string: "string";
	promiseObject_key: "value";
}> {
	const result = await util.getInternal(
		["boolean", "string", "promiseObject.key"],
		sampleRequest,
	);
	expectType<{ boolean: true; string: "string"; promiseObject_key: "value" }>(
		result,
	);
	return result;
}
expectType<
	Promise<{ boolean: true; string: "string"; promiseObject_key: "value" }>
>(testGetInternalFields());

// getInternal should get from internal store when object
async function testGetAndRemapInternal(): Promise<{
	newKey: string;
	newKey2: "value";
}> {
	const result = await util.getInternal(
		{ newKey: "promise", newKey2: "promiseObject.key" },
		sampleRequest,
	);
	expectType<{ newKey: string; newKey2: "value" }>(result);
	return result;
}
expectType<Promise<{ newKey: string; newKey2: "value" }>>(
	testGetAndRemapInternal(),
);

// getInternal should get from internal store a nested value
async function testGetInternalNested(): Promise<{
	promiseObject_key: "value";
}> {
	const result = await util.getInternal("promiseObject.key", sampleRequest);
	expectType<{ promiseObject_key: "value" }>(result);
	return result;
}
expectType<Promise<{ promiseObject_key: "value" }>>(testGetInternalNested());

// sanitizeKey
expectType<"_0key">(util.sanitizeKey("0key"));
expectType<"api_secret_key0_pem">(util.sanitizeKey("api//secret-key0.pem"));

const { value, expiry } = util.processCache<SSMClient, {}>(
	{},
	(request) => request,
	sampleRequest,
);
expectType<any>(value);
expectType<number>(expiry);

const cachedValue = util.getCache("someKey");
expectType<any>(cachedValue);

util.clearCache(["someKey", "someOtherKey"]);
util.clearCache("someKey");
util.clearCache(null);
util.clearCache();

const parsed = util.jsonSafeParse('{"foo":"bar"}', (k, v) => v);
expectType<any>(parsed);

const normalizedResponse = util.normalizeHttpResponse({}, {});
expectType<any>(normalizedResponse);

// should be able to use HttpError as a proper class
const err = util.createError(500, "An unexpected error occurred");
expectType<util.HttpError>(err);
// err instanceof util.HttpError // would throw a type error if not a class
