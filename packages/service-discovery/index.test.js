import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import {
	DiscoverInstancesCommand,
	ServiceDiscoveryClient,
} from "@aws-sdk/client-servicediscovery";
import { clearCache, getInternal } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import serviceDiscovery, { serviceDiscoveryValidateOptions } from "./index.js";

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

test("serviceDiscoveryValidateOptions accepts valid options and rejects typos", () => {
	serviceDiscoveryValidateOptions({ cacheKey: "x", cacheExpiry: 0 });
	serviceDiscoveryValidateOptions({});
	try {
		serviceDiscoveryValidateOptions({ cachExpiry: 60 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/service-discovery");
	}
});

test("serviceDiscoveryValidateOptions rejects wrong type", () => {
	try {
		serviceDiscoveryValidateOptions({ fetchData: 42 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("fetchData"));
	}
});

const rejects = (opts, fragment) => {
	try {
		serviceDiscoveryValidateOptions(opts);
		ok(false, `expected throw for ${JSON.stringify(opts)}`);
	} catch (e) {
		ok(e instanceof TypeError);
		if (fragment) ok(e.message.includes(fragment), e.message);
	}
};

const accepts = (opts) => {
	serviceDiscoveryValidateOptions(opts);
};

// optionSchema: top-level client options
test("validateOptions rejects non-Function AwsClient", () => {
	rejects({ AwsClient: "nope" }, "AwsClient");
	accepts({ AwsClient: () => {} });
});

test("validateOptions rejects non-object awsClientOptions", () => {
	rejects({ awsClientOptions: "nope" }, "awsClientOptions");
	accepts({ awsClientOptions: { region: "us-east-1" } });
});

test("validateOptions rejects non-string awsClientAssumeRole", () => {
	rejects({ awsClientAssumeRole: 42 }, "awsClientAssumeRole");
	accepts({ awsClientAssumeRole: "credentials" });
});

test("validateOptions rejects non-Function awsClientCapture", () => {
	rejects({ awsClientCapture: "nope" }, "awsClientCapture");
	accepts({ awsClientCapture: () => {} });
});

test("validateOptions rejects non-boolean disablePrefetch", () => {
	rejects({ disablePrefetch: "nope" }, "disablePrefetch");
	accepts({ disablePrefetch: true });
});

test("validateOptions rejects non-boolean setToContext", () => {
	rejects({ setToContext: "nope" }, "setToContext");
	accepts({ setToContext: true });
});

// optionSchema: fetchData shape
test("validateOptions rejects fetchData entry that is not an object", () => {
	rejects({ fetchData: { ec2: 42 } }, "ec2");
});

test("validateOptions rejects fetchData entry missing required NamespaceName", () => {
	rejects({ fetchData: { ec2: { ServiceName: "svc" } } }, "NamespaceName");
});

test("validateOptions rejects fetchData entry missing required ServiceName", () => {
	rejects({ fetchData: { ec2: { NamespaceName: "ns" } } }, "ServiceName");
});

test("validateOptions accepts fetchData entry with both required keys", () => {
	accepts({
		fetchData: { ec2: { NamespaceName: "ns", ServiceName: "svc" } },
	});
});

test("validateOptions rejects non-string fetchData NamespaceName", () => {
	rejects(
		{ fetchData: { ec2: { NamespaceName: 1, ServiceName: "svc" } } },
		"NamespaceName",
	);
});

test("validateOptions rejects non-string fetchData ServiceName", () => {
	rejects(
		{ fetchData: { ec2: { NamespaceName: "ns", ServiceName: 1 } } },
		"ServiceName",
	);
});

test("validateOptions rejects non-integer fetchData MaxResults", () => {
	rejects(
		{
			fetchData: {
				ec2: { NamespaceName: "ns", ServiceName: "svc", MaxResults: "x" },
			},
		},
		"MaxResults",
	);
});

test("validateOptions rejects fetchData MaxResults below minimum of 1", () => {
	rejects(
		{
			fetchData: {
				ec2: { NamespaceName: "ns", ServiceName: "svc", MaxResults: 0 },
			},
		},
		"MaxResults",
	);
	accepts({
		fetchData: {
			ec2: { NamespaceName: "ns", ServiceName: "svc", MaxResults: 1 },
		},
	});
});

test("validateOptions rejects non-object fetchData QueryParameters", () => {
	rejects(
		{
			fetchData: {
				ec2: { NamespaceName: "ns", ServiceName: "svc", QueryParameters: 1 },
			},
		},
		"QueryParameters",
	);
});

test("validateOptions rejects non-string fetchData QueryParameters value", () => {
	rejects(
		{
			fetchData: {
				ec2: {
					NamespaceName: "ns",
					ServiceName: "svc",
					QueryParameters: { k: 1 },
				},
			},
		},
		"QueryParameters",
	);
	accepts({
		fetchData: {
			ec2: {
				NamespaceName: "ns",
				ServiceName: "svc",
				QueryParameters: { k: "v" },
			},
		},
	});
});

test("validateOptions rejects non-object fetchData OptionalParameters", () => {
	rejects(
		{
			fetchData: {
				ec2: {
					NamespaceName: "ns",
					ServiceName: "svc",
					OptionalParameters: 1,
				},
			},
		},
		"OptionalParameters",
	);
});

test("validateOptions rejects non-string fetchData OptionalParameters value", () => {
	rejects(
		{
			fetchData: {
				ec2: {
					NamespaceName: "ns",
					ServiceName: "svc",
					OptionalParameters: { k: 1 },
				},
			},
		},
		"OptionalParameters",
	);
	accepts({
		fetchData: {
			ec2: {
				NamespaceName: "ns",
				ServiceName: "svc",
				OptionalParameters: { k: "v" },
			},
		},
	});
});

test("validateOptions rejects non-string fetchData HealthStatus", () => {
	rejects(
		{
			fetchData: {
				ec2: { NamespaceName: "ns", ServiceName: "svc", HealthStatus: 1 },
			},
		},
		"HealthStatus",
	);
});

test("validateOptions rejects fetchData HealthStatus not in enum", () => {
	rejects(
		{
			fetchData: {
				ec2: {
					NamespaceName: "ns",
					ServiceName: "svc",
					HealthStatus: "NOPE",
				},
			},
		},
		"HealthStatus",
	);
});

test("validateOptions accepts each valid HealthStatus enum value", () => {
	for (const HealthStatus of [
		"HEALTHY",
		"UNHEALTHY",
		"ALL",
		"HEALTHY_OR_ELSE_ALL",
	]) {
		accepts({
			fetchData: {
				ec2: { NamespaceName: "ns", ServiceName: "svc", HealthStatus },
			},
		});
	}
});

test("validateOptions allows extra (additional) properties on a fetchData entry", () => {
	accepts({
		fetchData: {
			ec2: { NamespaceName: "ns", ServiceName: "svc", ExtraThing: "ok" },
		},
	});
});

// optionSchema: cacheKeyExpiry
test("validateOptions rejects non-object cacheKeyExpiry", () => {
	rejects({ cacheKeyExpiry: 1 }, "cacheKeyExpiry");
});

test("validateOptions rejects non-number cacheKeyExpiry value", () => {
	rejects({ cacheKeyExpiry: { ec2: "nope" } }, "cacheKeyExpiry");
});

test("validateOptions rejects cacheKeyExpiry value below minimum of -1", () => {
	rejects({ cacheKeyExpiry: { ec2: -2 } }, "cacheKeyExpiry");
	accepts({ cacheKeyExpiry: { ec2: -1 } });
});

const instance = {
	Attributes: { AWS_INSTANCE_IPV4: "172.2.1.3", AWS_INSTANCE_PORT: "808" },
	HealthStatus: "UNKNOWN",
	InstanceId: "myservice-53",
	NamespaceName: "example.com",
	ServiceName: "myservice",
};

// Defaults: prefetch is enabled by default (disablePrefetch:false, cacheExpiry:-1)
// so the prefetch client is constructed at factory (.use) time, before the
// handler is invoked. If disablePrefetch defaulted to true, no client would be
// constructed until the before handler runs.
test("It should prefetch by default (client constructed before handler invocation)", async (t) => {
	let constructed = 0;
	class CountingClient extends ServiceDiscoveryClient {
		constructor(...args) {
			super(...args);
			constructed++;
		}
	}
	mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.resolves({ Instances: [instance] });

	const handler = middy(() => {}).use(
		serviceDiscovery({
			AwsClient: CountingClient,
			cacheKey: "prefetch-default-key",
			fetchData: {
				ec2: { NamespaceName: "example.com", ServiceName: "example" },
			},
		}),
	);

	// Prefetch constructed the client during .use().
	strictEqual(constructed, 1);

	await handler(defaultEvent, defaultContext);
});

// Default cacheExpiry is -1 (never expires): repeated invocations never re-fetch.
// If the default were a positive value, the cache would expire and re-fetch.
test("It should never expire the cache by default", async (t) => {
	const mockService = mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.resolves({ Instances: [instance] });
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		serviceDiscovery({
			AwsClient: ServiceDiscoveryClient,
			cacheKey: "never-expire-key",
			fetchData: {
				ec2: { NamespaceName: "example.com", ServiceName: "example" },
			},
		}),
	);

	await handler(defaultEvent, defaultContext);
	await new Promise((resolve) => setTimeout(resolve, 5));
	await handler(defaultEvent, defaultContext);

	strictEqual(sendStub.callCount, 1);
});

// Default setToContext is false: fetched data must NOT be written to context.
test("It should not write data to context by default", async (t) => {
	mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.resolves({ Instances: [instance] });

	const context = { getRemainingTimeInMillis: () => 1000 };
	const handler = middy(() => {});
	const middleware = async (request) => {
		// data is resolved into internal storage...
		const values = await getInternal(true, request);
		deepStrictEqual(values.ec2, [instance]);
		// ...but NOT copied onto context (setToContext defaults to false).
		strictEqual(request.context.ec2, undefined);
	};

	handler
		.use(
			serviceDiscovery({
				AwsClient: ServiceDiscoveryClient,
				cacheKey: "no-context-default-key",
				cacheExpiry: 0,
				fetchData: {
					ec2: { NamespaceName: "example.com", ServiceName: "example" },
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, context);
	strictEqual(context.ec2, undefined);
});

// Prefetch path: the prefetch client is used; the lazy `if (!client)` branch in
// the before handler must NOT recreate a client when prefetch already made one.
// We assert this by capturing how many ServiceDiscoveryClient instances exist:
// with prefetch, exactly one client is constructed for the whole lifecycle.
test("It should not recreate the client when a prefetch client exists", async (t) => {
	let constructed = 0;
	class CountingClient extends ServiceDiscoveryClient {
		constructor(...args) {
			super(...args);
			constructed++;
		}
	}
	mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.resolves({ Instances: [instance] });

	const handler = middy(() => {}).use(
		serviceDiscovery({
			AwsClient: CountingClient,
			fetchData: {
				ec2: { NamespaceName: "example.com", ServiceName: "example" },
			},
		}),
	);

	// Prefetch constructed the single client at factory time.
	strictEqual(constructed, 1);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

	// before handler reused the prefetch client; no new construction.
	strictEqual(constructed, 1);
});

// When prefetch is disabled, the prefetch block must NOT run: no client is
// constructed and no send happens until the handler is invoked.
test("It should not prefetch when disablePrefetch is true", async (t) => {
	let constructed = 0;
	class CountingClient extends ServiceDiscoveryClient {
		constructor(...args) {
			super(...args);
			constructed++;
		}
	}
	const mockService = mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.resolves({ Instances: [instance] });
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		serviceDiscovery({
			AwsClient: CountingClient,
			cacheExpiry: 0,
			fetchData: {
				ec2: { NamespaceName: "example.com", ServiceName: "example" },
			},
			disablePrefetch: true,
		}),
	);

	// No prefetch: nothing constructed or sent yet.
	strictEqual(constructed, 0);
	strictEqual(sendStub.callCount, 0);

	await handler(defaultEvent, defaultContext);

	// Lazy client created during the before handler.
	strictEqual(constructed, 1);
	strictEqual(sendStub.callCount, 1);
});

// setToContext cold path: the value is a pending promise, so assignSetToContext
// returns a pending promise that must be awaited before the context is read.
test("It should await the pending setToContext promise on a cold invocation", async (t) => {
	mockClient(ServiceDiscoveryClient)
		.on(DiscoverInstancesCommand)
		.resolves({ Instances: [instance] });

	const handler = middy((event, context) => context.ec2);

	handler.use(
		serviceDiscovery({
			AwsClient: ServiceDiscoveryClient,
			cacheExpiry: 0,
			fetchData: {
				ec2: { NamespaceName: "example.com", ServiceName: "example" },
			},
			setToContext: true,
			disablePrefetch: true,
		}),
	);

	const result = await handler(defaultEvent, {
		getRemainingTimeInMillis: () => 1000,
	});
	deepStrictEqual(result, [instance]);
});
