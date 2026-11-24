// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	DescribeSecretCommand,
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
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
	jsonSafeParse,
	processCache,
	reservedPropertyNames,
	setCacheKeyExpiry,
	validateOptions,
} from "@middy/util";

const name = "secrets-manager";
const pkg = `@middy/${name}`;

const hourMs = 60 * 60 * 1000;

const rotationDueRecheckMs = 60 * 1000;

// "rate(Value Unit)", where "Unit can be hour, hours, day, or days". "You can
// rotate a secret as often as every four hours", so only the plural names a
// schedule in hours.
// https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotate-secrets_schedule.html
const rateInHoursPattern = /rate\(\d+ hours\)/;

// Duration is "the length of the rotation window in hours, for
// example 3h for a three hour window. [...] If you don't specify a Duration,
// for a ScheduleExpression in hours, the window automatically closes after
// one hour. For a ScheduleExpression in days, the window automatically closes
// at the end of the UTC day." A window "must not extend into the next
// rotation window or the next UTC day", so 24 hours covers every schedule
// that is not a rate in hours: a rate in days, any cron expression (its hours
// field is not parsed) and AutomaticallyAfterDays.
// https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_RotationRulesType.html
const rotationWindowHours = (rotationRules) =>
	Number.parseInt(rotationRules?.Duration, 10) ||
	(rateInHoursPattern.test(rotationRules?.ScheduleExpression) ? 1 : 24);

const defaults = {
	AwsClient: SecretsManagerClient,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {},
	fetchRotationDate: false, // true: apply to all or {key: true} for individual
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
	contextKey: name,
};

const internalKeySchema = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:secrets-manager:options",
	$defs: { Function: false, Object: false },
	type: "object",
	properties: {
		AwsClient: { $ref: "#/$defs/Function" },
		awsClientOptions: awsClientOptionsSchema,
		awsClientAssumeRole: internalKeySchema,
		awsClientCapture: { $ref: "#/$defs/Function" },
		fetchData: {
			type: "object",
			propertyNames: internalKeySchema,
			maxProperties: 1024,
			required: [],
			// https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
			additionalProperties: {
				type: "string",
				maxLength: 2048,
				pattern: /^[\x21-\x7E]+$/u,
			},
			unevaluatedProperties: false,
		},
		fetchRotationDate: {
			oneOf: [
				{ type: "boolean" },
				{
					type: "object",
					propertyNames: internalKeySchema,
					maxProperties: 1024,
					required: [],
					additionalProperties: { type: "boolean" },
					unevaluatedProperties: false,
				},
			],
		},
		...cacheOptionSchemaProperties,
		setToContext: { type: "boolean" },
		contextKey: internalKeySchema,
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const secretsManagerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

// GetSecretValue carries the secret in exactly one of two fields: SecretBinary
// "if the secret value was originally provided as binary data" (a Uint8Array
// once the SDK has decoded it), otherwise "this field is omitted. The secret
// value appears in SecretString instead." Binary secrets are handed back as a
// Buffer.
// https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
const parseSecretValue = (resp) => {
	if (typeof resp.SecretBinary !== "undefined") {
		return Buffer.from(resp.SecretBinary);
	}
	return jsonSafeParse(resp.SecretString);
};

const secretsManagerMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		cacheKeyExpiry: { ...defaults.cacheKeyExpiry, ...opts.cacheKeyExpiry },
	};

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);

	let client;
	const send = (command) =>
		client
			.send(command)
			.catch((e) => catchInvalidSignatureException(e, client, command));

	// NextRotationDate is when the rotation window closes, not when the secret
	// rotates: "The next rotation is scheduled to occur on or before this date
	// ... This date represents the latest date that rotation will occur, but it
	// is not an approximate rotation date", and "Secrets Manager rotates your
	// secret at any time during this window." "If rotation is unsuccessful,
	// this date may be in the past."
	// https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_DescribeSecret.html
	// https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_RotationRulesType.html
	const learnRotationDate = (resp) => {
		if (resp.NextRotationDate) {
			// The SDK unmarshals NextRotationDate to a Date, but a custom client
			// may hand back the ISO string; `new Date()` yields epoch ms for both.
			const windowEnd = Number(new Date(resp.NextRotationDate));
			const windowStart =
				windowEnd - rotationWindowHours(resp.RotationRules) * hourMs;
			const now = Date.now();
			setCacheKeyExpiry(
				options,
				windowStart > now ? windowStart : now + rotationDueRecheckMs,
			);
		}
	};

	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};

		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;

			const SecretId = options.fetchData[internalKey];
			const fetchSecret = () =>
				send(new GetSecretValueCommand({ SecretId })).then(parseSecretValue);
			const fetchRotation =
				options.fetchRotationDate === true ||
				options.fetchRotationDate?.[internalKey];
			const fetched = fetchRotation
				? send(new DescribeSecretCommand({ SecretId }))
						.then(learnRotationDate)
						.then(fetchSecret)
				: fetchSecret();
			values[internalKey] = fetched.catch(
				evictCacheOnFailure(options.cacheKey, internalKey, values),
			);
		}
		return values;
	};

	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		processCache(options, fetchRequest);
	}

	const secretsManagerMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const clientInit = createClientInit(options);
	const secretsManagerMiddlewareBefore = (request) => {
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation (util memoises on
		// the credential promise identity, so a hit costs one microtask).
		if (client && !options.awsClientAssumeRole) {
			return secretsManagerMiddlewareFetch(request);
		}
		return clientInit(request).then((resolvedClient) => {
			client = resolvedClient;
			return secretsManagerMiddlewareFetch(request);
		});
	};

	return {
		before: secretsManagerMiddlewareBefore,
	};
};
export default secretsManagerMiddleware;

// used for TS type inference (see index.d.ts)
export function secretsManagerParam(name) {
	return name;
}
