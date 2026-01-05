import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import {
	DiscoverInstancesCommand,
	ServiceDiscoveryClient,
} from "@aws-sdk/client-servicediscovery";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
import serviceDiscovery from "./index.js";

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

const event = {};
const context = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should set instances to internal storage", async (t) => {
	mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.resolvesOnce({
			Instances: [
				{
					Attributes: {
						AWS_INSTANCE_IPV4: "172.2.1.3",
						AWS_INSTANCE_PORT: "808",
					},
					HealthStatus: "UNKNOWN",
					InstanceId: "myservice-53",
					NamespaceName: "example.com",
					ServiceName: "myservice",
				},
			],
		});

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(values.ec2, [
			{
				Attributes: {
					AWS_INSTANCE_IPV4: "172.2.1.3",
					AWS_INSTANCE_PORT: "808",
				},
				HealthStatus: "UNKNOWN",
				InstanceId: "myservice-53",
				NamespaceName: "example.com",
				ServiceName: "myservice",
			},
		]);
	};

	handler
		.use(
			serviceDiscovery({
				AwsClient: ServiceDiscoveryClient,
				cacheExpiry: 0,
				fetchData: {
					ec2: {
						NamespaceName: "example.com",
						ServiceName: "example",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set STS secret to internal storage without prefetch", async (t) => {
	mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.resolvesOnce({
			Instances: [
				{
					Attributes: {
						AWS_INSTANCE_IPV4: "172.2.1.3",
						AWS_INSTANCE_PORT: "808",
					},
					HealthStatus: "UNKNOWN",
					InstanceId: "myservice-53",
					NamespaceName: "example.com",
					ServiceName: "myservice",
				},
			],
		});

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(values.ec2, [
			{
				Attributes: {
					AWS_INSTANCE_IPV4: "172.2.1.3",
					AWS_INSTANCE_PORT: "808",
				},
				HealthStatus: "UNKNOWN",
				InstanceId: "myservice-53",
				NamespaceName: "example.com",
				ServiceName: "myservice",
			},
		]);
	};

	handler
		.use(
			serviceDiscovery({
				AwsClient: ServiceDiscoveryClient,
				cacheExpiry: 0,
				fetchData: {
					ec2: {
						NamespaceName: "example.com",
						ServiceName: "example",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should set STS secret to context", async (t) => {
	mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.resolvesOnce({
			Instances: [
				{
					Attributes: {
						AWS_INSTANCE_IPV4: "172.2.1.3",
						AWS_INSTANCE_PORT: "808",
					},
					HealthStatus: "UNKNOWN",
					InstanceId: "myservice-53",
					NamespaceName: "example.com",
					ServiceName: "myservice",
				},
			],
		});

	const handler = middy(() => {});

	const middleware = async (request) => {
		deepStrictEqual(request.context.ec2, [
			{
				Attributes: {
					AWS_INSTANCE_IPV4: "172.2.1.3",
					AWS_INSTANCE_PORT: "808",
				},
				HealthStatus: "UNKNOWN",
				InstanceId: "myservice-53",
				NamespaceName: "example.com",
				ServiceName: "myservice",
			},
		]);
	};

	handler
		.use(
			serviceDiscovery({
				AwsClient: ServiceDiscoveryClient,
				cacheExpiry: 0,
				fetchData: {
					ec2: {
						NamespaceName: "example.com",
						ServiceName: "example",
					},
				},
				setToContext: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should not call aws-sdk again if parameter is cached", async (t) => {
	const mockService = mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.resolvesOnce({
			Instances: [
				{
					Attributes: {
						AWS_INSTANCE_IPV4: "172.2.1.3",
						AWS_INSTANCE_PORT: "808",
					},
					HealthStatus: "UNKNOWN",
					InstanceId: "myservice-53",
					NamespaceName: "example.com",
					ServiceName: "myservice",
				},
			],
		});
	const sendStub = mockService.send;

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(values.ec2, [
			{
				Attributes: {
					AWS_INSTANCE_IPV4: "172.2.1.3",
					AWS_INSTANCE_PORT: "808",
				},
				HealthStatus: "UNKNOWN",
				InstanceId: "myservice-53",
				NamespaceName: "example.com",
				ServiceName: "myservice",
			},
		]);
	};

	handler
		.use(
			serviceDiscovery({
				AwsClient: ServiceDiscoveryClient,
				cacheExpiry: -1,
				fetchData: {
					ec2: {
						NamespaceName: "example.com",
						ServiceName: "example",
					},
				},
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	strictEqual(sendStub.callCount, 1);
});

test("It should call aws-sdk if cache enabled but cached param has expired", async (t) => {
	const mockService = mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.resolves({
			Instances: [
				{
					Attributes: {
						AWS_INSTANCE_IPV4: "172.2.1.3",
						AWS_INSTANCE_PORT: "808",
					},
					HealthStatus: "UNKNOWN",
					InstanceId: "myservice-53",
					NamespaceName: "example.com",
					ServiceName: "myservice",
				},
			],
		});
	const sendStub = mockService.send;

	const handler = middy(() => {});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		deepStrictEqual(values.ec2, [
			{
				Attributes: {
					AWS_INSTANCE_IPV4: "172.2.1.3",
					AWS_INSTANCE_PORT: "808",
				},
				HealthStatus: "UNKNOWN",
				InstanceId: "myservice-53",
				NamespaceName: "example.com",
				ServiceName: "myservice",
			},
		]);
	};

	handler
		.use(
			serviceDiscovery({
				AwsClient: ServiceDiscoveryClient,
				cacheExpiry: 0,
				fetchData: {
					ec2: {
						NamespaceName: "example.com",
						ServiceName: "example",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
	await handler(event, context);

	strictEqual(sendStub.callCount, 2);
});

test("It should catch if an error is returned from fetch", async (t) => {
	const mockService = mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.rejects("timeout");
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		serviceDiscovery({
			AwsClient: ServiceDiscoveryClient,
			cacheExpiry: 0,
			fetchData: {
				ec2: {
					NamespaceName: "example.com",
					ServiceName: "example",
				},
			},
			setToContext: true,
			disablePrefetch: true,
		}),
	);

	try {
		await handler(event, context);
	} catch (e) {
		strictEqual(sendStub.callCount, 1);
		strictEqual(e.message, "Failed to resolve internal values");
		deepStrictEqual(e.cause.data, [new Error("timeout")]);
	}
});
