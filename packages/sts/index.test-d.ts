import { STSClient } from "@aws-sdk/client-sts";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import sts, { type AssumedRoleCredentials, type Context } from "./index.js";

test("use with default options", () => {
	expect(sts()).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, Context<undefined>>
	>();
});

const options = {
	AwsClient: STSClient,
	awsClientCapture: captureAWSv3Client,
	disablePrefetch: true,
};

test("use with all options", () => {
	expect(sts(options)).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>
	>();
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("setToContext: true", () => {
	handler
		.use(
			sts({
				...options,
				fetchData: { foo: { RoleArn: "foo" } },
				setToContext: true,
			}),
		)
		.before(async (request) => {
			expect(request.context.foo).type.toBe<AssumedRoleCredentials>();

			const data = await getInternal("foo", request);
			expect(data.foo).type.toBe<AssumedRoleCredentials>();
		});
});

test("setToContext: false", () => {
	handler
		.use(
			sts({
				...options,
				fetchData: { foo: { RoleArn: "foo" } },
				setToContext: false,
			}),
		)
		.before(async (request) => {
			const data = await getInternal("foo", request);
			expect(data.foo).type.toBe<AssumedRoleCredentials>();
		});
});
