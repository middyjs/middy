// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import {
	awsClientOptionsSchema,
	cacheOptionSchemaProperties,
	canPrefetch,
	catchInvalidSignatureException,
	createClientInit,
	createPrefetchClient,
	HttpError,
	reservedPropertyNames,
	setContextNamespace,
	validateOptions,
} from "@middy/util";

const name = "s3-object-response";
const pkg = `@middy/${name}`;

const defaults = {
	AwsClient: S3Client,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	disablePrefetch: false,
	contextKey: name,
	// The presigned `inputS3Url` always points at the supporting access point:
	//   <access-point>-<account>.s3-accesspoint[-fips][.dualstack].<region>.amazonaws.com[.cn]
	// `*` stands for exactly one DNS label. Anything else under amazonaws.com
	// (EC2, a bucket endpoint, API Gateway, the Object Lambda endpoint itself)
	// is not a place S3 Object Lambda hands us a URL for.
	// https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html
	// https://docs.aws.amazon.com/general/latest/gr/s3.html#auto-endpoints-ap-s3
	allowedHosts: [
		"*.s3-accesspoint.*.amazonaws.com",
		"*.s3-accesspoint-fips.*.amazonaws.com",
		"*.s3-accesspoint.dualstack.*.amazonaws.com",
		"*.s3-accesspoint-fips.dualstack.*.amazonaws.com",
		"*.s3-accesspoint.*.amazonaws.com.cn",
		"*.s3-accesspoint.dualstack.*.amazonaws.com.cn",
	],
};

const keyNameRule = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
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

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:s3-object-response:options",
	$defs: { Function: false, Object: false },
	type: "object",
	properties: {
		AwsClient: functionRule,
		awsClientOptions: awsClientOptionsRule,
		awsClientAssumeRole: keyNameRule,
		awsClientCapture: functionRule,
		disablePrefetch: cacheOptionSchemaProperties.disablePrefetch,
		contextKey: keyNameRule,
		allowedHosts: {
			type: "array",
			// RFC 1035 section 2.3.4: "names - 255 octets or less"
			items: {
				type: "string",
				maxLength: 255,
				pattern: /^[\p{L}\p{M}\p{N}_*.-]+$/u,
			},
			maxItems: 1024,
			uniqueItems: true,
			unevaluatedItems: false,
		},
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const s3ObjectResponseValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// `new URL()` lowercases and punycode-encodes the host, so an entry compares
// equal to the hostname the presigned URL parses to. The round trip also
// rejects anything that isn't a bare hostname (port, path, credentials).
const normalizeAllowedHost = (entry) => {
	let url;
	try {
		url = new URL(`https://${entry}`);
	} catch {
		// `url` was declared without an initialiser, so it is already
		// undefined here; the check below is what reports it.
	}
	if (!url || url.href !== `https://${url.hostname}/`) {
		throw new TypeError(`${pkg}: allowedHosts entry must be a bare hostname`, {
			cause: { package: pkg, data: { entry } },
		});
	}
	return url.hostname;
};

// An entry with `*` matches label by label, `*` standing for exactly one
// label. Any other entry matches that hostname and its subdomains, with or
// without a leading dot.
const hostMatches = (hostname, allowedHost) => {
	if (allowedHost.includes("*")) {
		const want = allowedHost.split(".");
		const have = hostname.split(".");
		if (want.length !== have.length) return false;
		// `*` is exactly one label, so it does not stand for an empty one.
		return want.every((label, i) =>
			label === "*" ? have[i] !== "" : label === have[i],
		);
	}
	const domain = allowedHost.startsWith(".")
		? allowedHost.slice(1)
		: allowedHost;
	return hostname === domain || hostname.endsWith(`.${domain}`);
};

// The context each S3 Object Lambda operation puts on its event. Every one
// carries `inputS3Url`: for GetObject "a presigned URL that can be used to
// fetch the original object from Amazon S3", for HeadObject, ListObjects and
// ListObjectsV2 "a presigned URL for the supporting access point".
// https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-event-context.html
// https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html
const inputUrlContextNames = [
	"getObjectContext",
	"headObjectContext",
	"listObjectsContext",
	"listObjectsV2Context",
];

// Only a plain object is a WriteGetObjectResponse field map; a string, Buffer
// or stream is the Body itself and must not be spread element by element.
const isPlainObject = (value) => {
	if (typeof value !== "object" || value === null) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
};

// The error statuses in WriteGetObjectResponse's list of status codes for
// StatusCode, "the integer status code for an HTTP response of a
// corresponding GetObject request".
// https://docs.aws.amazon.com/AmazonS3/latest/API/API_WriteGetObjectResponse.html
const errorStatusCodes = new Set([
	400, 401, 403, 404, 405, 409, 411, 412, 416, 500, 503,
]);

// ErrorCode: "The regular expression (regex) value is "^[A-Z][a-zA-Z]+$"."
// https://docs.aws.amazon.com/AmazonS3/latest/API/API_WriteGetObjectResponse.html
const errorCodePattern = /^[A-Z][a-zA-Z]+$/;

const isExposableError = (error) =>
	error?.expose === true &&
	errorStatusCodes.has(error.statusCode) &&
	errorCodePattern.test(error.name);

// "You must URL encode any signed header values that contain spaces. For
// example, if your header value is my  file.txt, containing two spaces after
// my, you must URL encode this value to my%20%20file.txt." The SDK sends a
// header value as it is given and signs it with each run of spaces collapsed
// to one, so a run of spaces is what cannot be sent as written. Single spaces
// can, as in AWS's own ErrorMessage examples.
// https://docs.aws.amazon.com/AmazonS3/latest/API/API_WriteGetObjectResponse.html
// https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html
const encodeErrorMessage = (message) =>
	message?.includes("  ") ? encodeURIComponent(message) : message;

const s3ObjectResponseMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const allowedHosts = options.allowedHosts.map(normalizeAllowedHost);

	let client;
	const clientInit = createClientInit(options);
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
	}

	const assertAllowedInputUrl = (inputS3Url) => {
		let url;
		try {
			url = new URL(inputS3Url);
		} catch {
			// `url` was declared without an initialiser, so it is already
			// undefined here; the check below is what reports it.
		}
		const hostname = url?.hostname;
		const allowed =
			url?.protocol === "https:" &&
			url.port === "" &&
			allowedHosts.some((allowedHost) => hostMatches(hostname, allowedHost));
		if (!allowed) {
			// The query string carries the presigned credentials, so only the
			// host is reported.
			throw new HttpError(400, {
				cause: {
					package: pkg,
					data: {
						reason:
							"inputS3Url must be an https URL without a port on an allowed host",
						hostname,
						port: url?.port,
						allowedHosts: options.allowedHosts,
					},
				},
			});
		}
	};

	const s3ObjectResponseMiddlewareBefore = (request) => {
		for (const contextName of inputUrlContextNames) {
			const url = request.event[contextName]?.inputS3Url;
			if (url) assertAllowedInputUrl(url);
		}
		const { inputS3Url } = request.event.getObjectContext ?? {};
		// A GET that hangs past the invocation would be cut off by Lambda; abort
		// it 500 ms early instead so the failure surfaces. Outside Lambda (no
		// remaining-time budget) allow 30 s.
		const s3ObjectFetch = inputS3Url
			? fetch(inputS3Url, {
					signal: AbortSignal.timeout(
						Math.max(
							1000,
							(request.context.getRemainingTimeInMillis?.() ?? 30_000) - 500,
						),
					),
				})
			: undefined;
		// Suppress an unhandledRejection without swallowing the error: a consumer
		// that awaits context.middyContext[contextKey] still observes the real rejection.
		s3ObjectFetch?.catch(() => {});
		setContextNamespace(request, options.contextKey, s3ObjectFetch);
	};

	// RequestToken is "a single use encrypted token that maps
	// WriteGetObjectResponse to the end user GetObject request".
	// https://docs.aws.amazon.com/AmazonS3/latest/API/API_WriteGetObjectResponse.html
	const respondedRequests = new WeakSet();

	const writeGetObjectResponse = async (request, input) => {
		respondedRequests.add(request);
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation (util memoises on
		// the credential promise identity, so a hit costs one microtask).
		if (!client || options.awsClientAssumeRole) {
			client = await clientInit(request);
		}
		const { outputRoute, outputToken } = request.event.getObjectContext;
		const command = new WriteGetObjectResponseCommand({
			...input,
			RequestRoute: outputRoute,
			RequestToken: outputToken,
		});
		await client
			.send(command)
			.catch((e) => catchInvalidSignatureException(e, client, command));
	};

	const s3ObjectResponseMiddlewareAfter = async (request) => {
		// Only a GetObject event carries `getObjectContext`. For HeadObject,
		// ListObjects and ListObjectsV2 the "Lambda function should return a JSON
		// object".
		// https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html
		if (!request.event.getObjectContext) return;

		// Every other WriteGetObjectResponse field on a handler response object
		// (StatusCode, ContentType, Metadata, ErrorCode, ...) is passed through;
		// a bare string/Buffer/stream response is the Body.
		let input;
		if (isPlainObject(request.response)) {
			const { Body, body, ...fields } = request.response;
			input = { ...fields, Body: Body ?? body };
		} else {
			input = { Body: request.response ?? undefined };
		}
		await writeGetObjectResponse(request, input);

		return { statusCode: 200 };
	};

	// "If the Lambda function returns, with an exception or otherwise, before
	// the WriteGetObjectResponse API operation is called, the original caller
	// receives a 500 (Internal Server Error) response." "The Lambda function's
	// response, whether an exception is thrown or not, is ignored by S3 Object
	// Lambda."
	// https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html
	const s3ObjectResponseMiddlewareOnError = async (request) => {
		if (!request.event.getObjectContext || respondedRequests.has(request))
			return;
		const { statusCode, name, message } = isExposableError(request.error)
			? request.error
			: new HttpError(500);
		await writeGetObjectResponse(request, {
			StatusCode: statusCode,
			ErrorCode: name,
			ErrorMessage: encodeErrorMessage(message),
		});
	};

	return {
		before: s3ObjectResponseMiddlewareBefore,
		after: s3ObjectResponseMiddlewareAfter,
		onError: s3ObjectResponseMiddlewareOnError,
	};
};

export default s3ObjectResponseMiddleware;

// used for TS type inference (see index.d.ts)
export function s3ObjectResponseParam(name) {
	return name;
}
