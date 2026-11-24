// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import {
	assignSetToContext,
	awsClientOptionsSchema,
	buildSetToContextSpec,
	cacheOptionSchemaProperties,
	canPrefetch,
	evictCacheOnFailure,
	processCache,
	reservedPropertyNames,
	setCacheKeyExpiry,
	validateOptions,
} from "@middy/util";

const name = "dsql-signer";
const pkg = `@middy/${name}`;

// A DSQL authentication token "automatically expires in 15 minutes by
// default" (the maximum is 604,800 seconds); the SDK signer implements that
// as `expiresIn: 900`, the number of seconds the token is valid, unless the
// signer options override it. The token is cached for its validity minus a
// one minute margin so a warm container never presents an expired token. With
// an `expiresIn` of 60 s or less the margin leaves no lifetime, so the token
// is not cached and every invocation signs a fresh one.
// https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_authentication-token.html
const defaultExpiresIn = 900;
const expiryMarginMs = 60 * 1000;
const tokenLifetimeMs = (expiresIn) => expiresIn * 1000 - expiryMarginMs;

const defaults = {
	AwsClient: DsqlSigner,
	awsClientOptions: {},
	fetchData: {},
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
	contextKey: name,
};

const keyName = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};
const { credentials, profile, region, sha256 } =
	awsClientOptionsSchema.properties;

// DsqlSignerConfig: node_modules/@aws-sdk/dsql-signer/dist-types/Signer.d.ts,
// plus `username`, which picks the token method. awsClientOptions is merged
// into every fetchData entry, so both take it.
const signerOptions = {
	type: "object",
	properties: {
		credentials,
		// A token is signed for the cluster hostname: the endpoint
		// "$CLUSTERID.dsql.$REGION.on.aws", or through AWS PrivateLink
		// "{cluster-id}.{service-identifier}.{region}.on.aws" with an
		// identifier "such as dsql-fnh4". Without private DNS the token
		// still names the cluster endpoint, not the VPC endpoint.
		// https://docs.aws.amazon.com/aurora-dsql/latest/userguide/privatelink-managing-clusters.html
		// A domain name is "255 octets or less", 253 characters as text:
		// https://www.rfc-editor.org/rfc/rfc1035#section-2.3.4
		hostname: {
			type: "string",
			maxLength: 253,
			pattern:
				/^[a-z0-9]+\.dsql(-[a-z0-9]+)?\.[a-z]{2}-[a-z]+(-[a-z]+)?-\d+\.on\.aws$/u,
		},
		region,
		sha256,
		// "The maximum duration is 604,800 seconds, which is one week."
		// https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_authentication-token.html
		expiresIn: { type: "integer", minimum: 1, maximum: 604800 },
		profile,
		// "By default, NAMEDATALEN is 64 so the maximum identifier length is 63
		// bytes."
		// https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS
		username: {
			type: "string",
			maxLength: 63,
			pattern: /^[\p{L}\p{N}\p{P}\p{S} ]+$/u,
		},
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:dsql-signer:options",
	$defs: { Function: false, Object: false },
	type: "object",
	properties: {
		AwsClient: { $ref: "#/$defs/Function" },
		awsClientOptions: signerOptions,
		fetchData: {
			type: "object",
			propertyNames: keyName,
			maxProperties: 1024,
			required: [],
			additionalProperties: signerOptions,
			unevaluatedProperties: false,
		},
		...cacheOptionSchemaProperties,
		setToContext: { type: "boolean" },
		contextKey: keyName,
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const dsqlSignerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const omitUndefinedValues = (object) =>
	Object.fromEntries(
		Object.entries(object).filter(([, value]) => value !== undefined),
	);

const dsqlSignerMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		cacheKeyExpiry: { ...defaults.cacheKeyExpiry, ...opts.cacheKeyExpiry },
	};

	const envFetchData = omitUndefinedValues({
		hostname: process.env.PGHOST ?? process.env.DBHOST,
		username: process.env.PGUSER ?? process.env.DBUSER,
	});
	const fetchData = {};
	for (const key of Object.keys(options.fetchData)) {
		fetchData[key] = {
			...options.awsClientOptions,
			...envFetchData,
			...options.fetchData[key],
		};
		if (!fetchData[key].hostname) {
			throw new Error(
				`fetchData.${key}.hostname is required; set PGHOST, DBHOST, or pass hostname explicitly`,
				{ cause: { package: pkg } },
			);
		}
	}
	options.fetchData = fetchData;

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
	const clients = {};
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};
		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;

			const { username, ...signerOptions } = options.fetchData[internalKey];
			clients[internalKey] ??= new options.AwsClient(signerOptions);
			const lifetimeMs = tokenLifetimeMs(
				signerOptions.expiresIn ?? defaultExpiresIn,
			);
			const method =
				username === "admin"
					? "getDbConnectAdminAuthToken"
					: "getDbConnectAuthToken";
			values[internalKey] = clients[internalKey]
				[method]()
				.then((token) => {
					// Pre-signed token URLs always include X-Amz-Security-Token when temporary
					// credentials (IAM role) are used, which is always the case in Lambda.
					// A missing token usually indicates a credential or signing problem.
					if (!token.includes("X-Amz-Security-Token=")) {
						throw new Error("X-Amz-Security-Token Missing", {
							cause: { package: pkg, data: { method } },
						});
					}
					// A lifetime of zero or less records an expiry that has already
					// passed, which processCache treats as expired on the next read.
					setCacheKeyExpiry(options, Date.now() + lifetimeMs);
					return token;
				})
				.catch(evictCacheOnFailure(options.cacheKey, internalKey, values));
		}

		return values;
	};

	if (canPrefetch(options)) {
		processCache(options, fetchRequest);
	}

	const dsqlSignerMiddlewareBefore = (request) => {
		const { value } = processCache(options, fetchRequest, request);

		Object.assign(request.internal, value);

		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	return {
		before: dsqlSignerMiddlewareBefore,
	};
};
export default dsqlSignerMiddleware;

// used for TS type inference (see index.d.ts)
export function dsqlSignerParam(name) {
	return name;
}
