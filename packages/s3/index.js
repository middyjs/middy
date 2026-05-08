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
	jsonContentTypePattern,
	jsonSafeParse,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "s3";
const pkg = `@middy/${name}`;

const defaults = {
	AwsClient: S3Client,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {},
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
};

const optionSchema = {
	type: "object",
	properties: {
		AwsClient: { instanceof: "Function" },
		awsClientOptions: { type: "object" },
		awsClientAssumeRole: { type: "string" },
		awsClientCapture: { instanceof: "Function" },
		fetchData: {
			type: "object",
			additionalProperties: {
				type: "object",
				required: ["Bucket", "Key"],
				properties: {
					Bucket: { type: "string" },
					Key: { type: "string" },
					IfMatch: { type: "string" },
					IfNoneMatch: { type: "string" },
					Range: { type: "string" },
					ResponseContentType: { type: "string" },
					VersionId: { type: "string" },
					RequestPayer: { type: "string", enum: ["requester"] },
					PartNumber: { type: "integer", minimum: 1 },
					ChecksumMode: { type: "string", enum: ["ENABLED"] },
				},
				additionalProperties: true,
			},
		},
		disablePrefetch: { type: "boolean" },
		cacheKey: { type: "string" },
		cacheKeyExpiry: {
			type: "object",
			additionalProperties: { type: "number", minimum: -1 },
		},
		cacheExpiry: { type: "number", minimum: -1 },
		setToContext: { type: "boolean" },
	},
	additionalProperties: false,
};

export const s3ValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);
const s3Middleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
	};
	const fetchDataKeys = Object.keys(options.fetchData);
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			const command = new GetObjectCommand(options.fetchData[internalKey]);
			values[internalKey] = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then(async (resp) => {
					let value = await resp.Body.transformToString();
					if (jsonContentTypePattern.test(resp.ContentType)) {
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
	let clientInit;
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}
	const s3MiddlewareBefore = async (request) => {
		if (!client) {
			clientInit ??= createClient(options, request);
			client = await clientInit;
		}
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (options.setToContext) {
			const data = await getInternal(fetchDataKeys, request);
			Object.assign(request.context, data);
		}
	};
	return {
		before: s3MiddlewareBefore,
	};
};
export default s3Middleware;

// used for TS type inference (see index.d.ts)
export function s3Param(name) {
	return name;
}
