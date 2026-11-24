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
				vpceId: "",
				vpcId: "",
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
		middyContext: {},
	},
	response: undefined,
	error: undefined,
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
	expect(value).type.toBe<unknown>();
	expect(expiry).type.toBe<number>();
});

test("getCache", () => {
	const cachedValue = util.getCache("someKey");
	expect(cachedValue).type.toBe<unknown>();

	util.clearCache(["someKey", "someOtherKey"]);
	util.clearCache("someKey");
	util.clearCache(null);
	util.clearCache();
});

test("jsonSafeParse", () => {
	const parsed = util.jsonSafeParse('{"foo":"bar"}', (k, v) => v);
	expect(parsed).type.toBe<unknown>();
});

test("normalizeHttpResponse", () => {
	const normalizedResponse = util.normalizeHttpResponse(sampleRequest);
	expect(normalizedResponse).type.toBe<Record<string, unknown>>();
	expect(util.normalizeHttpResponse).type.not.toBeCallableWith(
		sampleRequest,
		{},
	);
});

test("HttpError", () => {
	const err = new util.HttpError(500, {
		cause: { package: "@middy/util", data: { reason: "unexpected" } },
	});
	expect(err).type.toBe<util.HttpError>();
});

test("HttpError properties", () => {
	const err = new util.HttpError(404);
	expect(err).type.toBe<util.HttpError>();
	expect(err.status).type.toBe<number>();
	expect(err.statusCode).type.toBe<number>();
	expect(err.expose).type.toBe<boolean>();
	expect(err.message).type.toBe<string>();
	expect(err instanceof util.HttpError).type.toBe<boolean>();
});

test("HttpError options", () => {
	expect(util.HttpError).type.toBeConstructableWith(400, { expose: true });
	expect(util.HttpError).type.toBeConstructableWith(400, { cause: "x" });
	expect(util.HttpError).type.toBeConstructableWith(400, {});
	// The message is always the reason phrase; the constructor never reads one.
	expect(util.HttpError).type.not.toBeConstructableWith(400, {
		message: "custom",
	});
	expect(util.HttpError).type.not.toBeConstructableWith(400, {
		expose: "yes",
	});
});

test("HttpError headers", () => {
	const err = new util.HttpError(401);
	expect(err.headers).type.toBe<
		Record<string, string | string[]> | undefined
	>();
	err.headers = { "WWW-Authenticate": "Bearer" };
	// No index signature: an undeclared property is a type error.
	expect(err).type.not.toHaveProperty("somethingElse");
});

test("modifyCache", () => {
	expect(util.modifyCache("someKey", { key: "value" })).type.toBe<void>();
});

test("createClientInit", () => {
	const initClient = util.createClientInit<SSMClient, {}>({
		AwsClient: SSMClient,
	});
	expect(initClient({} as middy.Request)).type.toBe<Promise<SSMClient>>();
});

test("evictCacheOnFailure", () => {
	const handler = util.evictCacheOnFailure("someKey", "internalKey");
	expect(handler(new Error("boom"))).type.toBe<never>();
	const values: Record<string, unknown> = {};
	expect(util.evictCacheOnFailure("someKey", "internalKey", values)).type.toBe<
		(e: unknown) => never
	>();
});

test("createClientInit infers the client from an SDK client class", () => {
	const initClient = util.createClientInit({
		AwsClient: SSMClient,
		awsClientOptions: { region: "ca-central-1" },
	});
	expect(initClient(sampleRequest)).type.toBe<Promise<SSMClient>>();
	expect(
		util.createPrefetchClient({ AwsClient: SSMClient, awsClientOptions: {} }),
	).type.toBe<SSMClient>();
});

test("helpers accept a structural request without @middy/core types", () => {
	const request = {
		event: { path: "/foo" },
		context: sampleRequest.context,
		response: undefined,
		error: undefined,
		internal: { key: "value" as const },
	};
	expect(util.getInternal("key", request)).type.toBe<
		Promise<{ key: "value" }>
	>();
	expect(util.contextNamespace(request, "ssm")).type.toBe<
		Record<string, unknown>
	>();
	expect(util.normalizeHttpResponse(request)).type.toBe<
		Record<string, unknown>
	>();
});

test("setCacheKeyExpiry", () => {
	expect(
		util.setCacheKeyExpiry(
			{ cacheKey: "someKey", cacheExpiry: -1, cacheKeyExpiry: {} },
			Date.now(),
		),
	).type.toBe<void>();
	expect(
		util.setCacheKeyExpiry(
			{ cacheKey: "someKey", cacheLearnedExpiry: { someKey: undefined } },
			Date.now(),
		),
	).type.toBe<void>();
});

test("cacheLearnedExpiry is internal to the cache helpers", () => {
	// Every package optionSchema rejects it, so it is not a user-facing option.
	expect<util.Options<unknown, unknown>>().type.not.toHaveProperty(
		"cacheLearnedExpiry",
	);
	expect(util.processCache).type.toBeCallableWith(
		{ cacheKey: "someKey", cacheExpiry: -1, cacheLearnedExpiry: {} },
		() => undefined,
	);
});

test("buildSetToContextSpec / assignSetToContext", () => {
	const spec = util.buildSetToContextSpec({
		fetchData: { "my-key": "x" },
		setToContext: true,
		contextKey: "ssm",
	});
	expect(spec).type.toBe<util.SetToContextSpec | null>();
	expect(
		util.buildSetToContextSpec({ fetchData: { "my-key": { region: "x" } } }),
	).type.toBe<util.SetToContextSpec | null>();
	if (spec) {
		expect(
			util.assignSetToContext(spec, { "my-key": "y" }, {} as middy.Request),
		).type.toBe<Promise<void> | undefined>();
	}
});

test("catchInvalidSignatureException", () => {
	const client = new SSMClient({});
	const result = util.catchInvalidSignatureException(
		new Error("test") as Error & { __type?: string },
		client,
		{},
	);
	expect(result).type.toBe<Promise<unknown>>();
});

test("decodeBody", () => {
	const decoded = util.decodeBody("hello", false);
	expect(decoded).type.toBe<string | null | undefined>();

	const decodedBase64 = util.decodeBody("aGVsbG8=", true);
	expect(decodedBase64).type.toBe<string | null | undefined>();

	const decodedNull = util.decodeBody(null);
	expect(decodedNull).type.toBe<string | null | undefined>();

	const decodedUndefined = util.decodeBody(undefined);
	expect(decodedUndefined).type.toBe<string | null | undefined>();
});

test("lambdaContextKeys", () => {
	expect(util.lambdaContextKeys).type.toBe<string[]>();
});

test("isExecutionModeDurable", () => {
	expect(
		util.isExecutionModeDurable(sampleRequest.context),
	).type.toBe<boolean>();
	// called with the durable context in durable mode, and with
	// `request?.context`
	const durableContext = {
		lambdaContext: sampleRequest.context,
		executionContext: { durableExecutionArn: "arn" },
	};
	expect(util.isExecutionModeDurable(durableContext)).type.toBe<boolean>();
	expect(util.isExecutionModeDurable(undefined)).type.toBe<boolean>();
});

test("resolveHttpEventVersion", () => {
	expect(util.resolveHttpEventVersion(sampleRequest.event)).type.toBe<string>();
	expect(
		util.resolveHttpEventVersion({ version: "2.0", rawPath: "/" }),
	).type.toBe<string>();
});

test("buildPathTree", () => {
	const tree = util.buildPathTree(["event.headers.authorization"]);
	expect(tree).type.toBe<util.PathTree>();
	expect(
		util.buildPathTree([["event", "CodePipeline.job", "data"]]),
	).type.toBe<util.PathTree>();
	const paths: util.OmitPath[] = ["event.Records.[].body", ["event", "a.b"]];
	expect(util.buildPathTree(paths)).type.toBe<util.PathTree>();
	const readonlyPaths = [["event", "a.b"], "event.c"] as const;
	expect(util.buildPathTree(readonlyPaths)).type.toBe<util.PathTree>();
});

test("buildPathTree rejects a segment that is not a string", () => {
	expect(util.buildPathTree).type.not.toBeCallableWith([["event", "list", 0]]);
	expect(util.buildPathTree).type.not.toBeCallableWith([0]);
	expect<util.OmitPath>().type.toBe<string | ReadonlyArray<string>>();
});

test("omitPathsSchema is an option schema rule", () => {
	expect(util.omitPathsSchema).type.toBe<util.ArrayRule>();
	const schema: util.OptionSchema = {
		type: "object",
		properties: { omitPaths: util.omitPathsSchema },
		additionalProperties: false,
	};
	expect(schema).type.toBe<util.OptionSchema>();
});

test("awsClientOptionsSchema is an option schema rule", () => {
	expect(util.awsClientOptionsSchema).type.toBe<util.ObjectRule>();
	const schema: util.OptionSchema = {
		$defs: { Function: false, Object: false },
		type: "object",
		properties: { awsClientOptions: util.awsClientOptionsSchema },
		additionalProperties: false,
	};
	expect(schema).type.toBe<util.OptionSchema>();
});

test("cacheOptionSchemaProperties spreads into properties", () => {
	expect(
		util.cacheOptionSchemaProperties.cacheKey,
	).type.toBe<util.StringRule>();
	expect(
		util.cacheOptionSchemaProperties.cacheKeyExpiry,
	).type.toBe<util.ObjectRule>();
	expect(
		util.cacheOptionSchemaProperties.cacheExpiry,
	).type.toBe<util.NumberRule>();
	expect(
		util.cacheOptionSchemaProperties.cacheMaxSize,
	).type.toBe<util.NumberRule>();
	expect(
		util.cacheOptionSchemaProperties.disablePrefetch,
	).type.toBe<util.BooleanRule>();
	const schema: util.OptionSchema = {
		type: "object",
		properties: { ...util.cacheOptionSchemaProperties },
		additionalProperties: false,
	};
	expect(schema).type.toBe<util.OptionSchema>();
});

test("validateOmitPaths", () => {
	expect(util.validateOmitPaths(["event.body"])).type.toBe<void>();
	expect(util.validateOmitPaths(undefined)).type.toBe<void>();
	const readonlyPaths = [["event", "a.b"], "event.c"] as const;
	expect(util.validateOmitPaths(readonlyPaths)).type.toBe<void>();
	expect(util.validateOmitPaths).type.not.toBeCallableWith([["event", 0]]);
	expect(util.validateOmitPaths).type.not.toBeCallableWith("event.body");
});

test("pathTreeOmitsString", () => {
	const tree = util.buildPathTree(["response.body"]);
	expect(
		util.pathTreeOmitsString(tree, ["response", "body"]),
	).type.toBe<boolean>();
	expect(
		util.pathTreeOmitsString(undefined, ["response"]),
	).type.toBe<boolean>();
	const segments = ["response"] as const;
	expect(util.pathTreeOmitsString(tree, segments)).type.toBe<boolean>();
	expect(util.pathTreeOmitsString).type.not.toBeCallableWith(tree, "response");
	expect(util.pathTreeOmitsString).type.not.toBeCallableWith(
		["response"],
		["response"],
	);
});

test("isUnwrappedHttpResponse", () => {
	expect(util.isUnwrappedHttpResponse({ foo: "bar" })).type.toBe<boolean>();
	expect(util.isUnwrappedHttpResponse(undefined)).type.toBe<boolean>();
	expect(
		util.isUnwrappedHttpResponse(sampleRequest.response),
	).type.toBe<boolean>();
	expect(util.isUnwrappedHttpResponse).type.not.toBeCallableWith();
});

test("omit returns the value type when no tree is passed", () => {
	expect(util.omit(sampleRequest)).type.toBe<typeof sampleRequest>();
});

test("omit types an Error it may have turned into a plain object", () => {
	const tree = util.buildPathTree(["error.cause.data.body"]);
	expect(util.omit(sampleRequest, tree)).type.toBe<
		util.Omitted<typeof sampleRequest>
	>();
	const request = {
		error: new Error("x") as Error | undefined,
		event: { body: "" },
	};
	type Redacted = {
		error: Error | util.OmittedError | undefined;
		event: { body: string };
	};
	expect(util.omit(request, tree)).type.toBe<Redacted>();
	expect(util.omit(request, tree, "***")).type.toBe<Redacted>();
	expect(util.omit(request, undefined)).type.toBe<Redacted>();
	expect(util.omit(new TypeError("x"), tree)).type.toBe<
		TypeError | util.OmittedError
	>();
	expect(
		util.omit({ errors: [new Error("x")], n: 1, f: (): number => 1 }, tree),
	).type.toBe<{
		errors: (Error | util.OmittedError)[];
		n: number;
		f: () => number;
	}>();
	expect(util.omit("s" as string, tree)).type.toBe<string>();
	expect(util.omit(sampleRequest as unknown, tree)).type.toBe<unknown>();
	expect<util.OmittedError>().type.not.toBeAssignableTo<Error>();
	expect<util.OmittedError>().type.toHaveProperty("name");
});

test("reservedPropertyNames is a readonly list of names", () => {
	expect(util.reservedPropertyNames).type.toBe<readonly string[]>();
});

test("validateOptions returns the options it validated", () => {
	const schema = {
		type: "object",
		properties: { name: { type: "string" } },
		additionalProperties: false,
	} as const;
	const options = { name: "foo" };
	expect(util.validateOptions("@middy/test", schema, options)).type.toBe<{
		name: string;
	}>();
	expect(util.validateOptions("@middy/test", schema)).type.toBe<
		Record<string, unknown>
	>();
});

test("option schema rules declare the size keywords", () => {
	expect<util.ArrayRule>().type.toHaveProperty("minItems");
	expect<util.ArrayRule>().type.toHaveProperty("maxItems");
	expect<util.ObjectRule>().type.toHaveProperty("maxProperties");
	expect<util.ArrayRule>().type.toHaveProperty("uniqueItems");
	const schema: util.OptionSchema = {
		type: "object",
		properties: {
			topics: {
				type: "array",
				items: { type: "string" },
				minItems: 1,
				maxItems: 5,
			},
			dimensions: {
				type: "object",
				additionalProperties: { type: "string" },
				maxProperties: 30,
			},
		},
		additionalProperties: false,
	};
	expect(util.validateOptions("@middy/test", schema)).type.toBe<
		Record<string, unknown>
	>();
});

test("a rule may carry constraints next to const, enum, oneOf, allOf and $ref", () => {
	const schema: util.OptionSchema = {
		$defs: { Array: false },
		type: "object",
		properties: {
			mode: { type: "string", enum: ["a", "b"], minLength: 1 },
			level: { type: "integer", const: 5, minimum: 1 },
			path: { type: "string", allOf: [{ type: "string", pattern: /^\//u }] },
			list: { type: "array", $ref: "#/$defs/Array", minItems: 1 },
			target: {
				type: "object",
				properties: { x: { type: "string" } },
				additionalProperties: false,
				oneOf: [{ type: "object", required: ["x"] }],
			},
			either: { oneOf: [{ type: "string" }, { type: "array" }], minItems: 1 },
		},
		additionalProperties: false,
	};
	expect(schema).type.toBeAssignableTo<util.ObjectRule>();
});

test("option schema rules declare the sast-json-schema keywords", () => {
	expect<util.ArrayRule["uniqueItems"]>().type.toBe<boolean | undefined>();
	expect<util.ArrayRule["unevaluatedItems"]>().type.toBe<false | undefined>();
	expect<util.ObjectRule["unevaluatedProperties"]>().type.toBe<
		false | undefined
	>();
	expect<util.ObjectRule["propertyNames"]>().type.toBe<
		util.OptionSchemaRule | undefined
	>();
	expect<util.ObjectRule["required"]>().type.toBe<
		readonly string[] | undefined
	>();
	expect<util.NumberRule["exclusiveMaximum"]>().type.toBe<number | undefined>();
	expect<util.RefRule["$ref"]>().type.toBe<`#/$defs/${string}`>();
	expect<util.RefRule>().type.toBeAssignableTo<util.OptionSchemaRule>();
	expect<{
		$ref: "#/definitions/Function";
	}>().type.not.toBeAssignableTo<util.RefRule>();
	expect<{
		instanceof: "Function";
	}>().type.not.toBeAssignableTo<util.OptionSchemaRule>();
});

test("OptionSchema is the root of an option schema", () => {
	const schema: util.OptionSchema = {
		$schema: "https://json-schema.org/draft/2020-12/schema",
		$id: "urn:middy:test:options",
		$defs: { Function: false },
		type: "object",
		properties: {
			handler: { $ref: "#/$defs/Function" },
			name: { type: "string", pattern: /^[a-z]+$/u, maxLength: 64 },
			routes: {
				type: "array",
				items: { $ref: "#/$defs/Function" },
				maxItems: 10,
				uniqueItems: true,
				unevaluatedItems: false,
			},
			tags: {
				type: "object",
				additionalProperties: {
					type: "string",
					maxLength: 64,
					pattern: /^.$/u,
				},
				unevaluatedProperties: false,
				propertyNames: { type: "string", maxLength: 64, pattern: /^[a-z]$/u },
				maxProperties: 10,
				required: [],
			},
			ratio: { type: "number", minimum: 0, exclusiveMaximum: 1 },
		},
		required: [],
		additionalProperties: false,
		unevaluatedProperties: false,
	};
	expect(util.validateOptions("@middy/test", schema)).type.toBe<
		Record<string, unknown>
	>();
	expect<util.OptionSchema["$schema"]>().type.toBe<
		"https://json-schema.org/draft/2020-12/schema" | undefined
	>();
	expect<util.OptionSchema["$id"]>().type.toBe<string | undefined>();
	expect<util.OptionSchema["$defs"]>().type.toBe<
		Record<string, false> | undefined
	>();
	expect<util.OptionSchema>().type.toBeAssignableTo<util.ObjectRule>();
});

test("type may be null or a list of type names", () => {
	expect<util.JsonSchemaType>().type.toBe<
		"string" | "number" | "integer" | "boolean" | "null" | "object" | "array"
	>();
	expect<util.TypeListRule["type"]>().type.toBe<
		readonly util.JsonSchemaType[]
	>();
	expect<util.EnumRule["type"]>().type.toBe<
		util.JsonSchemaType | readonly util.JsonSchemaType[] | undefined
	>();
	expect<{ type: "null" }>().type.toBeAssignableTo<util.OptionSchemaRule>();
	expect<{
		type: "string";
		pattern: string;
	}>().type.not.toBeAssignableTo<util.OptionSchemaRule>();
	expect<{
		type: "string";
		pattern: RegExp;
		not: { type: "string"; enum: readonly string[] };
	}>().type.toBeAssignableTo<util.OptionSchemaRule>();
	expect<{
		type: ["string", "bigint"];
	}>().type.not.toBeAssignableTo<util.OptionSchemaRule>();
	const header = {
		type: "string",
		maxLength: 8,
		pattern: /^[a-z]+$/u,
	} as const;
	const schema: util.OptionSchema = {
		type: "object",
		properties: {
			defaultHeaders: {
				type: ["string", "array"],
				maxLength: 8,
				pattern: /^[a-z]+$/u,
				items: header,
				maxItems: 2,
				uniqueItems: true,
				unevaluatedItems: false,
			},
			expectedClaims: {
				type: ["string", "number", "boolean"],
				minimum: 0,
				maximum: 100,
				maxLength: 8,
				pattern: /^[a-z]+$/u,
			},
			nothing: { type: ["string", "null"] },
		},
		additionalProperties: false,
	};
	expect(util.validateOptions("@middy/test", schema)).type.toBe<
		Record<string, unknown>
	>();
});

test("ObjectRule declares patternProperties", () => {
	expect<util.ObjectRule["patternProperties"]>().type.toBe<
		Record<string, util.OptionSchemaRule> | undefined
	>();
	const tag = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8}){0,127}$/u;
	const schema: util.OptionSchema = {
		$defs: { Function: false },
		type: "object",
		properties: {
			languages: {
				type: "object",
				patternProperties: { [tag.source]: { $ref: "#/$defs/Function" } },
				propertyNames: { type: "string", maxLength: 1024, pattern: tag },
				maxProperties: 1024,
				additionalProperties: false,
				required: [],
				unevaluatedProperties: false,
			},
		},
		additionalProperties: false,
	};
	expect(util.validateOptions("@middy/test", schema)).type.toBe<
		Record<string, unknown>
	>();
});

// The d.ts carries its own structural Lambda context instead of importing
// aws-lambda; it must stay interchangeable with the aws-lambda one.
test("LambdaContext is interchangeable with aws-lambda Context", () => {
	expect<util.LambdaContext>().type.toBeAssignableTo<LambdaContext>();
	expect<LambdaContext>().type.toBeAssignableTo<util.LambdaContext>();
	type Namespaced = util.ContextNamespace<{}, "ssm", { key: string }>;
	expect<Namespaced>().type.toBeAssignableTo<LambdaContext>();
	expect<Namespaced["middyContext"]["ssm"]>().type.toBe<{ key: string }>();
	expect<Namespaced["functionName"]>().type.toBe<string>();
});

test("Request accepts an aws-lambda Context", () => {
	expect(
		util.contextNamespace(
			{} as util.Request<unknown, unknown, Error, LambdaContext>,
			"key",
		),
	).type.toBe<Record<string, unknown>>();
});
