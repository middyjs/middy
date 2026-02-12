// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	DescribeSecretCommand,
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import {
	canPrefetch,
	catchInvalidSignatureException,
	createClient,
	createPrefetchClient,
	getCache,
	getInternal,
	jsonSafeParse,
	modifyCache,
	processCache,
} from "@middy/util";

const defaults = {
	AwsClient: SecretsManagerClient,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {},
	fetchRotationDate: false, // true: apply to all or {key: true} for individual
	disablePrefetch: false,
	cacheKey: "secrets-manager",
	cacheKeyExpiry: {},
	cacheExpiry: -1, // ignored when fetchRotationRules is true/object
	setToContext: false,
};

const secretsManagerMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		cacheKeyExpiry: { ...defaults.cacheKeyExpiry, ...opts.cacheKeyExpiry },
	};

	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};

		for (const internalKey of Object.keys(options.fetchData)) {
			if (cachedValues[internalKey]) continue;

			values[internalKey] = Promise.resolve()
				.then(() => {
					if (
						options.fetchRotationDate === true ||
						options.fetchRotationDate?.[internalKey]
					) {
						const command = new DescribeSecretCommand({
							SecretId: options.fetchData[internalKey],
						});
						return client
							.send(command)
							.catch((e) => catchInvalidSignatureException(e, client, command))
							.then((resp) => {
								if (options.cacheExpiry < 0) {
									options.cacheKeyExpiry[internalKey] =
										resp.NextRotationDate * 1000;
								} else {
									options.cacheKeyExpiry[internalKey] = Math.min(
										Math.max(resp.LastRotationDate, resp.LastChangedDate) *
											1000 +
											options.cacheExpiry,
										resp.NextRotationDate * 1000,
									);
								}
							});
					}
				})
				.then(() => {
					const command = new GetSecretValueCommand({
						SecretId: options.fetchData[internalKey],
					});
					return client
						.send(command)
						.catch((e) => catchInvalidSignatureException(e, client, command));
				})
				.then((resp) => jsonSafeParse(resp.SecretString))
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

	const secretsManagerMiddlewareBefore = async (request) => {
		if (!client) {
			client = await createClient(options, request);
		}

		const { value } = processCache(options, fetchRequest, request);

		Object.assign(request.internal, value);

		if (options.setToContext) {
			const data = await getInternal(Object.keys(options.fetchData), request);
			Object.assign(request.context, data);
		}
	};

	return {
		before: secretsManagerMiddlewareBefore,
	};
};
export default secretsManagerMiddleware;

// used for TS type inference (see index.d.ts)
export function secret(name) {
	return name;
}
