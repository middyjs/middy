// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { Signer } from "@aws-sdk/rds-signer";
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

const name = "rds-signer";
const pkg = `@middy/${name}`;

// The SDK signer issues tokens with `expiresIn: 900` (15 min). Refresh one
// minute early so a warm container never presents an expired token.
const tokenLifetimeMs = 14 * 60 * 1000;

const defaults = {
	AwsClient: Signer,
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

// SignerConfig: node_modules/@aws-sdk/rds-signer/dist-types/Signer.d.ts
// awsClientOptions is merged into every fetchData entry, so both take it.
const signerOptions = {
	type: "object",
	properties: {
		credentials,
		// A domain name is "255 octets or less", 253 characters as text, of
		// letters, digits, hyphens and dots; an IP address adds colons:
		// https://www.rfc-editor.org/rfc/rfc1035#section-2.3.4
		hostname: { type: "string", maxLength: 253, pattern: /^[A-Za-z0-9.:-]+$/u },
		port: { type: "integer", minimum: 1, maximum: 65535 },
		region,
		sha256,
		// "By default, NAMEDATALEN is 64 so the maximum identifier length is 63
		// bytes."
		// https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS
		username: {
			type: "string",
			maxLength: 63,
			pattern: /^[\p{L}\p{N}\p{P}\p{S} ]+$/u,
		},
		profile,
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:rds-signer:options",
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

export const rdsSignerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const omitUndefinedValues = (object) =>
	Object.fromEntries(
		Object.entries(object).filter(([, value]) => value !== undefined),
	);

const rdsSignerMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		cacheKeyExpiry: { ...defaults.cacheKeyExpiry, ...opts.cacheKeyExpiry },
	};

	const envPort = process.env.PGPORT ?? process.env.DBPORT;
	const envFetchData = omitUndefinedValues({
		hostname: process.env.PGHOST ?? process.env.DBHOST,
		port: envPort === undefined ? undefined : Number.parseInt(envPort, 10),
		username: process.env.PGUSER ?? process.env.DBUSER,
	});
	const fetchData = {};
	for (const key of Object.keys(options.fetchData)) {
		fetchData[key] = {
			port: 5432,
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
		// The token names "the database account that you want to access" (it
		// carries `DBUser=`), so one signed without a username cannot
		// authenticate:
		// https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.Connecting.AWSCLI.PostgreSQL.html
		if (!fetchData[key].username) {
			throw new Error(
				`fetchData.${key}.username is required; set PGUSER, DBUSER, or pass username explicitly`,
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

			clients[internalKey] ??= new options.AwsClient(
				options.fetchData[internalKey],
			);
			const method = "getAuthToken";
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
					setCacheKeyExpiry(options, Date.now() + tokenLifetimeMs);
					return token;
				})
				.catch(evictCacheOnFailure(options.cacheKey, internalKey, values));
		}

		return values;
	};

	if (canPrefetch(options)) {
		processCache(options, fetchRequest);
	}

	const rdsSignerMiddlewareBefore = (request) => {
		const { value } = processCache(options, fetchRequest, request);

		Object.assign(request.internal, value);

		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	return {
		before: rdsSignerMiddlewareBefore,
	};
};
export default rdsSignerMiddleware;

// used for TS type inference (see index.d.ts)
export function rdsSignerParam(name) {
	return name;
}
