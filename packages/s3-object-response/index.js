// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { S3Client, WriteGetObjectResponseCommand } from "@aws-sdk/client-s3";
import {
	canPrefetch,
	catchInvalidSignatureException,
	createClientInit,
	createPrefetchClient,
	HttpError,
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

const optionSchema = {
	type: "object",
	properties: {
		AwsClient: { instanceof: "Function" },
		awsClientOptions: { type: "object" },
		awsClientAssumeRole: { type: "string" },
		awsClientCapture: { instanceof: "Function" },
		disablePrefetch: { type: "boolean" },
		contextKey: { type: "string" },
		allowedHosts: { type: "array", items: { type: "string" } },
	},
	additionalProperties: false,
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
		// Stryker disable next-line EqualityOperator: equivalent; the label counts were just checked equal, so an extra iteration compares want[len] with have[len], both undefined, which can never return false.
		for (let i = 0; i < want.length; i += 1) {
			// `*` is exactly one label, so it does not stand for an empty one.
			if (want[i] === "*" ? have[i] === "" : want[i] !== have[i]) return false;
		}
		return true;
	}
	const domain = allowedHost.startsWith(".")
		? allowedHost.slice(1)
		: allowedHost;
	return hostname === domain || hostname.endsWith(`.${domain}`);
};

// Only a plain object is a WriteGetObjectResponse field map; a string, Buffer
// or stream is the Body itself and must not be spread element by element.
const isPlainObject = (value) => {
	if (typeof value !== "object" || value === null) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
};

const s3ObjectResponseMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const allowedHosts = options.allowedHosts.map(normalizeAllowedHost);

	let client;
	const clientInit = createClientInit(options);
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
	}

	// `getObjectContext.inputS3Url` is the presigned URL for the original object
	// on the supporting access point. Only fetch from a host in `allowedHosts`,
	// on the default https port, otherwise a crafted event could turn the
	// function into an open GET proxy.
	// https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html
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
		const { inputS3Url } = request.event.getObjectContext ?? {};

		if (inputS3Url) assertAllowedInputUrl(inputS3Url);
		const s3ObjectFetch = inputS3Url ? fetch(inputS3Url) : undefined;
		// Suppress an unhandledRejection without swallowing the error: a consumer
		// that awaits context.middyContext[contextKey] still observes the real rejection.
		s3ObjectFetch?.catch(() => {});
		setContextNamespace(request, options.contextKey, s3ObjectFetch);
	};

	const s3ObjectResponseMiddlewareAfter = async (request) => {
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation (util memoises on
		// the credential promise identity, so a hit costs one microtask).
		if (!client || options.awsClientAssumeRole) {
			client = await clientInit(request);
		}

		// Every other WriteGetObjectResponse field on a handler response object
		// (StatusCode, ContentType, Metadata, ErrorCode, ...) is passed through;
		// a bare string/Buffer/stream response is the Body. The route and token
		// always come from the event.
		let input;
		if (isPlainObject(request.response)) {
			const { Body, body, ...fields } = request.response;
			input = { ...fields, Body: Body ?? body };
		} else {
			input = { Body: request.response ?? undefined };
		}
		const command = new WriteGetObjectResponseCommand({
			...input,
			RequestRoute: request.event.getObjectContext?.outputRoute,
			RequestToken: request.event.getObjectContext?.outputToken,
		});
		await client
			.send(command)
			// ?. required due to mockClient able to return undefined
			?.catch((e) => catchInvalidSignatureException(e, client, command));

		return { statusCode: 200 };
	};

	return {
		before: s3ObjectResponseMiddlewareBefore,
		after: s3ObjectResponseMiddlewareAfter,
	};
};

export default s3ObjectResponseMiddleware;

// used for TS type inference (see index.d.ts)
export function s3ObjectResponseParam(name) {
	return name;
}
