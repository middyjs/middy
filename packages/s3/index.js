// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
	assignSetToContext,
	awsClientOptionsSchema,
	buildSetToContextSpec,
	cacheOptionSchemaProperties,
	canPrefetch,
	catchInvalidSignatureException,
	createClientInit,
	createPrefetchClient,
	evictCacheOnFailure,
	jsonContentTypePattern,
	jsonSafeParse,
	processCache,
	reservedPropertyNames,
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
	contextKey: name,
};

const keyNameRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};
const headerValueRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x20-\x7E]+$/u,
};

const functionRule = { $ref: "#/$defs/Function" };
const booleanRule = { type: "boolean" };
const orProvider = (rule) => ({ oneOf: [rule, functionRule] });
const checksumModeRule = orProvider({
	type: "string",
	enum: ["WHEN_SUPPORTED", "WHEN_REQUIRED"],
});

// The S3ClientConfigType keys beyond the ones every client shares:
// node_modules/@aws-sdk/client-s3/dist-types/S3Client.d.ts
const awsClientOptionsRule = {
	...awsClientOptionsSchema,
	properties: {
		...awsClientOptionsSchema.properties,
		bucketEndpoint: booleanRule,
		checksumAlgorithms: {
			type: "object",
			properties: {
				CRC32: functionRule,
				CRC32C: functionRule,
				CRC64NVME: functionRule,
				SHA1: functionRule,
				SHA256: functionRule,
			},
			required: [],
			additionalProperties: false,
			unevaluatedProperties: false,
		},
		clientContextParams: {
			type: "object",
			properties: { disableS3ExpressSessionAuth: orProvider(booleanRule) },
			required: [],
			additionalProperties: false,
			unevaluatedProperties: false,
		},
		disableMultiregionAccessPoints: booleanRule,
		disableS3ExpressSessionAuth: orProvider(booleanRule),
		eventStreamSerdeProvider: functionRule,
		expectContinueHeader: {
			oneOf: [
				booleanRule,
				{ type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
			],
		},
		followRegionRedirects: booleanRule,
		forcePathStyle: booleanRule,
		getAwsChunkedEncodingStream: functionRule,
		md5: functionRule,
		requestChecksumCalculation: checksumModeRule,
		// "A minimum of 8kb = 8 * 1024 is required"
		requestStreamBufferSize: {
			oneOf: [
				{ type: "integer", minimum: 8192, maximum: Number.MAX_SAFE_INTEGER },
				{ type: "boolean", const: false },
			],
		},
		responseChecksumValidation: checksumModeRule,
		s3ExpressIdentityProvider: { $ref: "#/$defs/Object" },
		sdkStreamMixin: functionRule,
		sha1: functionRule,
		sigv4aSigningRegionSet: orProvider({
			type: "array",
			items: { type: "string", maxLength: 63, pattern: /^[A-Za-z0-9*-]+$/u },
			maxItems: 1024,
			uniqueItems: true,
			unevaluatedItems: false,
		}),
		streamHasher: functionRule,
		useAccelerateEndpoint: booleanRule,
		useArnRegion: orProvider(booleanRule),
		useGlobalEndpoint: orProvider(booleanRule),
	},
};

// GetObject request parameters:
// https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html
const getObjectInputSchema = {
	type: "object",
	properties: {
		Bucket: { type: "string", maxLength: 1024, pattern: /^[\w.:/-]+$/u },
		// "a sequence of Unicode characters with UTF-8 encoding of up to 1,024
		// bytes long"
		// https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html
		Key: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u,
		},
		ChecksumMode: { type: "string", enum: ["ENABLED"] },
		ExpectedBucketOwner: {
			type: "string",
			minLength: 12,
			maxLength: 12,
			pattern: /^\d+$/u,
		},
		IfMatch: headerValueRule,
		IfModifiedSince: { $ref: "#/$defs/Date" },
		IfNoneMatch: headerValueRule,
		IfUnmodifiedSince: { $ref: "#/$defs/Date" },
		// "a positive integer between 1 and 10,000"
		PartNumber: { type: "integer", minimum: 1, maximum: 10000 },
		// "Amazon S3 doesn't support retrieving multiple ranges of data per GET
		// request."
		Range: { type: "string", maxLength: 1024, pattern: /^bytes=\d*-\d*$/u },
		RequestPayer: { type: "string", enum: ["requester"] },
		ResponseCacheControl: headerValueRule,
		ResponseContentDisposition: headerValueRule,
		ResponseContentEncoding: headerValueRule,
		ResponseContentLanguage: headerValueRule,
		ResponseContentType: headerValueRule,
		ResponseExpires: { $ref: "#/$defs/Date" },
		SSECustomerAlgorithm: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\w-]+$/u,
		},
		SSECustomerKey: headerValueRule,
		// The base64 of a 128-bit MD5 digest is 24 characters.
		SSECustomerKeyMD5: {
			type: "string",
			maxLength: 24,
			pattern: /^[A-Za-z0-9+/=]+$/u,
		},
		VersionId: keyNameRule,
	},
	required: ["Bucket", "Key"],
	additionalProperties: false,
	unevaluatedProperties: false,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:s3:options",
	$defs: { Date: false, Function: false, Object: false },
	type: "object",
	properties: {
		AwsClient: functionRule,
		awsClientOptions: awsClientOptionsRule,
		awsClientAssumeRole: keyNameRule,
		awsClientCapture: functionRule,
		fetchData: {
			type: "object",
			propertyNames: keyNameRule,
			maxProperties: 1024,
			required: [],
			additionalProperties: getObjectInputSchema,
			unevaluatedProperties: false,
		},
		...cacheOptionSchemaProperties,
		setToContext: { type: "boolean" },
		contextKey: keyNameRule,
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const s3ValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);
const s3Middleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
	};
	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			const command = new GetObjectCommand(options.fetchData[internalKey]);
			values[internalKey] = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then(async (resp) => {
					if (!resp.Body) {
						throw new Error("S3 GetObject response missing Body", {
							cause: { package: pkg, data: { internalKey } },
						});
					}
					let value = await resp.Body.transformToString();
					if (jsonContentTypePattern.test(resp.ContentType)) {
						value = jsonSafeParse(value);
					}
					return value;
				})
				.catch(evictCacheOnFailure(options.cacheKey, internalKey, values));
		}
		return values;
	};
	let client;
	const clientInit = createClientInit(options);
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}
	const s3MiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const s3MiddlewareBefore = (request) => {
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation (util memoises on
		// the credential promise identity, so a hit costs one microtask).
		if (client && !options.awsClientAssumeRole) {
			return s3MiddlewareFetch(request);
		}
		return clientInit(request).then((resolvedClient) => {
			client = resolvedClient;
			return s3MiddlewareFetch(request);
		});
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
