import {
	type HttpInstanceSummary,
	ServiceDiscoveryClient,
} from "@aws-sdk/client-servicediscovery";
import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import serviceDiscovery, { type Context } from "./index.js";

test("use with default options", () => {
	expect(serviceDiscovery()).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<undefined>>
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
		middy.MiddlewareObj<unknown, unknown, Error, Context<typeof options>>
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
			expect(request.context.middyContext["service-discovery"].foo).type.toBe<
				HttpInstanceSummary[]
			>();

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

test("accepts contextKey", () => {
	expect(serviceDiscovery).type.toBeCallableWith({ contextKey: "custom" });
});

test("contextKey renames the context namespace", () => {
	handler
		.use(
			serviceDiscovery({
				...options,
				fetchData: { foo: { NamespaceName: "ns", ServiceName: "svc" } },
				setToContext: true,
				contextKey: "custom" as const,
			}),
		)
		.before(async (request) => {
			expect(request.context.middyContext.custom.foo).type.toBe<
				HttpInstanceSummary[]
			>();
		});
});

test("contextKey literal narrows middyContext without as const", () => {
	handler
		.use(
			serviceDiscovery({
				...options,
				fetchData: { foo: { NamespaceName: "ns", ServiceName: "svc" } },
				setToContext: true,
				contextKey: "custom",
			}),
		)
		.before(async (request) => {
			expect(request.context.middyContext.custom.foo).type.toBe<
				HttpInstanceSummary[]
			>();
		});
});

test("rejects misspelled option alongside fetchData", () => {
	expect(serviceDiscovery).type.not.toBeCallableWith({
		fetchData: { foo: { NamespaceName: "foo", ServiceName: "bar" } },
		cacheExpiery: 1000,
	});
});

test("accepts cacheMaxSize", () => {
	expect(serviceDiscovery).type.toBeCallableWith({
		fetchData: { foo: { NamespaceName: "foo", ServiceName: "bar" } },
		cacheMaxSize: 10,
	});
});

test("serviceDiscoveryValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.ServiceDiscoveryOptions;
	expect(
		indexModule.serviceDiscoveryValidateOptions(options),
	).type.toBe<indexModule.ServiceDiscoveryOptions>();
});
