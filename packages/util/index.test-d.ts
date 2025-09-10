import { SSMClient } from "@aws-sdk/client-ssm";
import type middy from "@middy/core";
import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context as LambdaContext,
} from "aws-lambda";
import { expect, test } from "tstyche";
import * as util from "./index.js";

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

test("createPrefetchClient", () => {
	const prefetchClient = util.createPrefetchClient<SSMClient, {}>({
		AwsClient: SSMClient,
	});
	expect(prefetchClient).type.toBe<SSMClient>();
});

test("createClient", () => {
	const client = util.createClient<SSMClient, {}>(
		{ AwsClient: SSMClient },
		sampleRequest,
	);
	expect(client).type.toBe<Promise<SSMClient>>();
});

test("canPrefetch", () => {
	const canPrefetch = util.canPrefetch<SSMClient, {}>({ AwsClient: SSMClient });
	expect(canPrefetch).type.toBe<boolean>();
});

test("getInternal should get none from internal store", () => {
	async function testGetInternalNone(): Promise<{}> {
		const result = await util.getInternal(false, sampleRequest);
		expect(result).type.toBe<{}>();
		return result;
	}
	expect(testGetInternalNone()).type.toBe<Promise<{}>>();
});

test("getInternal should get all from internal store", () => {
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
		expect(result).type.toBe<DeepAwaitedTInternal>();
		return result;
	}
	expect(testGetAllInternal()).type.toBe<Promise<DeepAwaitedTInternal>>();
});

test("getInternal should get from internal store when string", () => {
	async function testGetInternalField(): Promise<{ number: 1 }> {
		const result = await util.getInternal("number", sampleRequest);
		expect(result).type.toBe<{ number: 1 }>();
		return result;
	}
	expect(testGetInternalField()).type.toBe<Promise<{ number: 1 }>>();
});

test("getInternal should get from internal store when array[string]", () => {
	async function testGetInternalFields(): Promise<{
		boolean: true;
		string: "string";
		promiseObject_key: "value";
	}> {
		const result = await util.getInternal(
			["boolean", "string", "promiseObject.key"],
			sampleRequest,
		);
		expect(result).type.toBe<{
			boolean: true;
			string: "string";
			promiseObject_key: "value";
		}>();
		return result;
	}
	expect(testGetInternalFields()).type.toBe<
		Promise<{ boolean: true; string: "string"; promiseObject_key: "value" }>
	>();
});

test("getInternal should get from internal store when object", () => {
	async function testGetAndRemapInternal(): Promise<{
		newKey: string;
		newKey2: "value";
	}> {
		const result = await util.getInternal(
			{ newKey: "promise", newKey2: "promiseObject.key" },
			sampleRequest,
		);
		expect(result).type.toBe<{ newKey: string; newKey2: "value" }>();
		return result;
	}
	expect(testGetAndRemapInternal()).type.toBe<
		Promise<{ newKey: string; newKey2: "value" }>
	>();
});

test("getInternal should get from internal store a nested value", () => {
	async function testGetInternalNested(): Promise<{
		promiseObject_key: "value";
	}> {
		const result = await util.getInternal("promiseObject.key", sampleRequest);
		expect(result).type.toBe<{ promiseObject_key: "value" }>();
		return result;
	}
	expect(testGetInternalNested()).type.toBe<
		Promise<{ promiseObject_key: "value" }>
	>();
});

test("sanitizeKey", () => {
	expect(util.sanitizeKey("0key")).type.toBe<"_0key">();
	expect(
		util.sanitizeKey("api//secret-key0.pem"),
	).type.toBe<"api_secret_key0_pem">();
});

test("processCache", () => {
	const { value, expiry } = util.processCache<SSMClient, {}>(
		{},
		(request) => request,
		sampleRequest,
	);
	expect(value).type.toBe<any>();
	expect(expiry).type.toBe<number>();
});

test("getCache", () => {
	const cachedValue = util.getCache("someKey");
	expect(cachedValue).type.toBe<any>();

	util.clearCache(["someKey", "someOtherKey"]);
	util.clearCache("someKey");
	util.clearCache(null);
	util.clearCache();
});

test("jsonSafeParse", () => {
	const parsed = util.jsonSafeParse('{"foo":"bar"}', (k, v) => v);
	expect(parsed).type.toBe<any>();
});

test("normalizeHttpResponse", () => {
	const normalizedResponse = util.normalizeHttpResponse({}, {});
	expect(normalizedResponse).type.toBe<any>();
});

test("createError", () => {
	const err = util.createError(500, "An unexpected error occurred");
	expect(err).type.toBe<util.HttpError>();
	// err instanceof util.HttpError // would throw a type error if not a class
});
