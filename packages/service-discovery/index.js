import {
	DiscoverInstancesCommand,
	ServiceDiscoveryClient,
} from "@aws-sdk/client-servicediscovery";
import {
	canPrefetch,
	catchInvalidSignatureException,
	createClient,
	createPrefetchClient,
	getCache,
	getInternal,
	modifyCache,
	processCache,
} from "@middy/util";

const defaults = {
	AwsClient: ServiceDiscoveryClient,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {}, // { contextKey: {NamespaceName, ServiceName, HealthStatus} }
	disablePrefetch: false,
	cacheKey: "cloud-map",
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
};

const serviceDiscoveryMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};

		for (const internalKey of Object.keys(options.fetchData)) {
			if (cachedValues[internalKey]) continue;

			const command = new DiscoverInstancesCommand(
				options.fetchData[internalKey],
			);
			values[internalKey] = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then((resp) => resp.Instances)
				.catch((e) => {
					const value = getCache(options.cacheKey).value ?? {};
					value[internalKey] = undefined;
					modifyCache(options.cacheKey, value);
					throw e;
				});
		}

		return values;
	};

	let client;
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}

	const serviceDiscoveryMiddlewareBefore = async (request) => {
		if (!client) {
			client = await createClient(options, request);
		}

		const { value } = processCache(options, fetchRequest, request);

		Object.assign(request.internal, value);

		if (options.setToContext) {
			const data = await getInternal(Object.keys(options.fetchData), request);
			if (options.setToContext) Object.assign(request.context, data);
		}
	};

	return {
		before: serviceDiscoveryMiddlewareBefore,
	};
};
export default serviceDiscoveryMiddleware;
