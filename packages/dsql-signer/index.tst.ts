import { DsqlSigner } from "@aws-sdk/dsql-signer";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { expect, test } from "tstyche";
import dsqlSigner from "./index.js";

test("use with default options", () => {
	const middleware = dsqlSigner();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

const options = {
	AwsClient: DsqlSigner,
	awsClientOptions: {
		credentials: {
			secretAccessKey: "secret",
			accessKeyId: "key",
		},
	},
	awsClientAssumeRole: "some-role",
	fetchData: {
		foo: {
			hostname: "cluster.dsql.ca-central-1.on.aws",
			username: "admin",
		},
	},
	disablePrefetch: true,
	cacheKey: "some-key",
	cacheExpiry: 60 * 60 * 5,
	setToContext: true,
};

test("use with no options", () => {
	expect(dsqlSigner()).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error>
	>();
});

test("use with all options", () => {
	expect(dsqlSigner(options)).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, LambdaContext, { foo: string }>
	>();
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("use with setToContext: true", () => {
	handler
		.use(
			dsqlSigner({
				...options,
				setToContext: true,
			}),
		)
		.before(async (request) => {
			expect(request.context.foo).type.toBe<string>();

			const data = await getInternal("foo", request);
			expect(data.foo).type.toBe<string>();
		});
});

test("use with setToContext: false", () => {
	handler
		.use(
			dsqlSigner({
				...options,
				setToContext: false,
			}),
		)
		.before(async (request) => {
			const data = await getInternal("foo", request);
			expect(data.foo).type.toBe<string>();
		});
});
