import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import dynamodb, { type Context, dynamoDbParam } from "./index.js";

const options = {
	AwsClient: DynamoDBClient,
	awsClientOptions: {
		credentials: {
			secretAccessKey: "secret",
			sessionToken: "token",
			accessKeyId: "key",
		},
	},
	awsClientAssumeRole: "some-role",
	awsClientCapture: captureAWSv3Client,
	disablePrefetch: true,
	cacheKey: "some-key",
	cacheExpiry: 60 * 60 * 5,
	cacheKeyExpiry: {},
	setToContext: false,
} as const;

test("use with default options", () => {
	expect(dynamodb()).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<undefined>>
	>();
});

test("use with all options", () => {
	expect(dynamodb(options)).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<typeof options>>
	>();
});

test("use with setToContext: true", () => {
	expect(
		dynamodb({
			...options,
			fetchData: {
				configurationObjFromDynamo: {
					TableName: "someConfigTableName",
					Key: {
						pk: {
							S: "someConfigItemPrimaryKey",
						},
					},
				},
			},
			setToContext: true,
		}),
	).type.toBe<
		middy.MiddlewareObj<
			unknown,
			unknown,
			Error,
			LambdaContext & { configurationObjFromDynamo: Record<string, any> },
			{ configurationObjFromDynamo: Record<string, any> }
		>
	>();
});

test("use with setToContext: false", () => {
	expect(
		dynamodb({
			...options,
			fetchData: {
				configurationObjFromDynamo: {
					TableName: "someConfigTableName",
					Key: {
						pk: {
							S: "someConfigItemPrimaryKey",
						},
					},
				},
			},
			setToContext: false,
		}),
	).type.toBe<
		middy.MiddlewareObj<
			unknown,
			unknown,
			Error,
			LambdaContext,
			{ configurationObjFromDynamo: Record<string, any> }
		>
	>();
});

expect(dynamodb).type.not.toBeCallableWith({
	...options,
	fetchData: "not an object", // fetchData must be an object
});

expect(dynamodb).type.not.toBeCallableWith({
	...options,
	fetchData: {
		key: "null", // fetchData must be an object of objects
		key2: null, // fetchData must be an object of objects
		key3: undefined, // fetchData must be an object of objects
		key4: 1, // fetchData must be an object of objects
		key5: true, // fetchData must be an object of objects
		key6: Symbol("key6"), // fetchData must be an object of objects
	},
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

handler
	.use(
		dynamodb({
			...options,
			fetchData: {
				configurationObjFromDynamo: {
					TableName: "someConfigTableName",
					Key: {
						pk: {
							S: "someConfigItemPrimaryKey",
						},
					},
				},
			},
			setToContext: true,
		}),
	)
	.before(async (request) => {
		expect(request.context.configurationObjFromDynamo).type.toBe<
			Record<string, any>
		>();

		const data = await getInternal("configurationObjFromDynamo", request);
		expect(data.configurationObjFromDynamo).type.toBe<Record<string, any>>();
	});

handler
	.use(
		dynamodb({
			...options,
			fetchData: {
				configurationObjFromDynamo: {
					TableName: "someConfigTableName",
					Key: {
						pk: {
							S: "someConfigItemPrimaryKey",
						},
					},
				},
			},
			setToContext: false,
		}),
	)
	.before(async (request) => {
		const data = await getInternal("configurationObjFromDynamo", request);
		expect(data.configurationObjFromDynamo).type.toBe<Record<string, any>>();
	});

handler
	.use(
		dynamodb({
			...options,
			fetchData: {
				configurationObjFromDynamo: dynamoDbParam<{
					param1: string;
					param2: string;
					param3: number;
				}>({
					TableName: "someConfigTableName",
					Key: {
						pk: {
							S: "someConfigItemPrimaryKey",
						},
					},
				}),
			},
			setToContext: true,
		}),
	)
	.before(async (request) => {
		expect(request.context.configurationObjFromDynamo).type.toBe<{
			param1: string;
			param2: string;
			param3: number;
		}>();

		const data = await getInternal("configurationObjFromDynamo", request);
		expect(data.configurationObjFromDynamo).type.toBe<{
			param1: string;
			param2: string;
			param3: number;
		}>();
	});

handler
	.use(
		dynamodb({
			...options,
			fetchData: {
				configurationObjFromDynamo: dynamoDbParam<{
					param1: string;
					param2: string;
					param3: number;
				}>({
					TableName: "someConfigTableName",
					Key: {
						pk: {
							S: "someConfigItemPrimaryKey",
						},
					},
				}),
			},
			setToContext: false,
		}),
	)
	.before(async (request) => {
		const data = await getInternal("configurationObjFromDynamo", request);
		expect(data.configurationObjFromDynamo).type.toBe<{
			param1: string;
			param2: string;
			param3: number;
		}>();
	});
