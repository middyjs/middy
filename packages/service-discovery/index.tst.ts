import {
	type HttpInstanceSummary,
	ServiceDiscoveryClient,
} from "@aws-sdk/client-servicediscovery";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import serviceDiscovery, { type Context } from "./index.js";

test("use with default options", () => {
	expect(serviceDiscovery()).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, Context<undefined>>
	>();
});

const options = {
	AwsClient: ServiceDiscoveryClient,
	awsClientOptions: {},
	awsClientAssumeRole: "some-role",
	awsClientCapture: captureAWSv3Client,
	disablePrefetch: true,
};

test("use with all options", () => {
	expect(serviceDiscovery()).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, Context<typeof options>>
	>();
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("setToContext: true", () => {
	handler
		.use(
			serviceDiscovery({
				...options,
				fetchData: { foo: { NamespaceName: "foo", ServiceName: "bar" } },
				setToContext: true,
			}),
		)
		.before(async (request) => {
			expect(request.context.foo).type.toBe<HttpInstanceSummary[]>();

			const data = await getInternal("foo", request);
			expect(data.foo).type.toBe<HttpInstanceSummary[]>();
		});
});

test("setToContext: false", () => {
	handler
		.use(
			serviceDiscovery({
				...options,
				fetchData: { foo: { NamespaceName: "foo", ServiceName: "bar" } },
				setToContext: false,
			}),
		)
		.before(async (request) => {
			const data = await getInternal("foo", request);
			expect(data.foo).type.toBe<HttpInstanceSummary[]>();
		});
});
