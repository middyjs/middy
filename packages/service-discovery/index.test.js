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

const defaultEvent = {};
const defaultContext = {
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

	await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
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

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

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

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

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
		await handler(defaultEvent, defaultContext);
	} catch (e) {
		strictEqual(sendStub.callCount, 1);
		strictEqual(e.message, "Failed to resolve internal values");
		deepStrictEqual(e.cause.data, [new Error("timeout")]);
	}
});

test("It should skip fetching already cached values when fetching multiple keys", async (t) => {
	let callCount = 0;
	const mockService = mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.callsFake(async () => {
			callCount++;
			// First call for service1 succeeds
			if (callCount === 1) {
				return {
					Instances: [
						{
							Attributes: {
								AWS_INSTANCE_IPV4: "172.2.1.3",
								AWS_INSTANCE_PORT: "801",
							},
							HealthStatus: "UNKNOWN",
							InstanceId: "myservice-1",
							NamespaceName: "example.com",
							ServiceName: "myservice",
						},
					],
				};
			}
			// First call for service2 fails
			if (callCount === 2) {
				throw new Error("timeout");
			}
			// Second call only fetches service2 (service1 is cached)
			if (callCount === 3) {
				return {
					Instances: [
						{
							Attributes: {
								AWS_INSTANCE_IPV4: "172.2.1.4",
								AWS_INSTANCE_PORT: "802",
							},
							HealthStatus: "UNKNOWN",
							InstanceId: "myservice-2",
							NamespaceName: "example.com",
							ServiceName: "myservice",
						},
					],
				};
			}
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.service1[0].Attributes.AWS_INSTANCE_PORT, "801");
		strictEqual(values.service2[0].Attributes.AWS_INSTANCE_PORT, "802");
	};

	const handler = middy(() => {})
		.use(
			serviceDiscovery({
				AwsClient: ServiceDiscoveryClient,
				cacheExpiry: 1000,
				fetchData: {
					service1: {
						NamespaceName: "example.com",
						ServiceName: "service1",
					},
					service2: {
						NamespaceName: "example.com",
						ServiceName: "service2",
					},
				},
			}),
		)
		.before(middleware);

	// First call - service1 succeeds, service2 fails
	try {
		await handler(defaultEvent, defaultContext);
	} catch (_e) {
		// Expected to fail
	}

	// Second call - only service2 is fetched (service1 is already cached)
	await handler(defaultEvent, defaultContext);

	// Should have called send 3 times total (service1 once, service2 twice)
	strictEqual(sendStub.callCount, 3);
});

test("It should export serviceDiscoveryParam helper for TypeScript type inference", async (t) => {
	const { serviceDiscoveryParam } = await import("./index.js");
	const paramName = "test-param";
	const result = serviceDiscoveryParam(paramName);
	strictEqual(result, paramName);
});
