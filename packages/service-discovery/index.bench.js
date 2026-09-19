import { bench } from "node:bench";
import {
	DiscoverInstancesCommand,
	ServiceDiscoveryClient,
} from "@aws-sdk/client-servicediscovery";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	mockClient(ServiceDiscoveryClient)
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
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: ServiceDiscoveryClient,
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler();

const defaultEvent = {};

bench("service-discovery: without cache", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await coldHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});

bench("service-discovery: with cache", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});
