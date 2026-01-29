// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
	AwsClient: S3Client,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {},
	disablePrefetch: false,
	cacheKey: "s3",
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
};
const contentTypePattern = /^application\/(.+\+)?json($|;.+)/;
const s3Middleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
	};
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of Object.keys(options.fetchData)) {
			if (cachedValues[internalKey]) continue;
			const command = new GetObjectCommand(options.fetchData[internalKey]);
			values[internalKey] = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then(async (resp) => {
					let value = await resp.Body.transformToString();
					if (contentTypePattern.test(resp.ContentType)) {
						value = jsonSafeParse(value);
					}
					return value;
				})
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
	const s3MiddlewareBefore = async (request) => {
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
		before: s3MiddlewareBefore,
	};
};
export default s3Middleware;

// used for TS type inference (see index.d.ts)
export function s3Req(req) {
	return req;
}
