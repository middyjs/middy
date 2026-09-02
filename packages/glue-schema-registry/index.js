// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { GetSchemaVersionCommand, GlueClient } from "@aws-sdk/client-glue";
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	catchInvalidSignatureException,
	clearCache,
	createClient,
	createPrefetchClient,
	getCache,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "glue-schema-registry";
const pkg = `@middy/${name}`;

const defaults = {
	AwsClient: GlueClient,
	awsClientOptions: {},
	awsClientAssumeRole: undefined,
	awsClientCapture: undefined,
	fetchData: {}, // { internalKey: { SchemaVersionId } | { SchemaId, SchemaVersionNumber } }
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	cacheExpiry: -1,
	setToContext: false,
	contextKey: name,
};

const optionSchema = {
	type: "object",
	properties: {
		AwsClient: { instanceof: "Function" },
		awsClientOptions: { type: "object" },
		awsClientAssumeRole: { type: "string" },
		awsClientCapture: { instanceof: "Function" },
		disablePrefetch: { type: "boolean" },
		cacheKey: { type: "string" },
		cacheKeyExpiry: {
			type: "object",
			additionalProperties: { type: "number", minimum: -1 },
		},
		cacheExpiry: { type: "number", minimum: -1 },
		setToContext: { type: "boolean" },
		contextKey: { type: "string" },
		fetchData: {
			type: "object",
			additionalProperties: {
				oneOf: [
					{
						type: "object",
						required: ["SchemaVersionId"],
						properties: { SchemaVersionId: { type: "string" } },
						additionalProperties: true,
					},
					{
						type: "object",
						required: ["SchemaId"],
						properties: {
							SchemaId: {
								type: "object",
								properties: {
									SchemaName: { type: "string" },
									RegistryName: { type: "string" },
									SchemaArn: { type: "string" },
								},
								additionalProperties: true,
							},
							SchemaVersionNumber: {
								type: "object",
								properties: {
									VersionNumber: { type: "integer", minimum: 1 },
									LatestVersion: { type: "boolean" },
								},
								additionalProperties: true,
							},
						},
						additionalProperties: true,
					},
				],
			},
		},
	},
	additionalProperties: false,
};

export const glueSchemaRegistryValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const glueSchemaRegistryMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		fetchData: structuredClone({ ...defaults.fetchData, ...opts.fetchData }),
	};

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);
	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};

		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;
			const command = new GetSchemaVersionCommand(
				options.fetchData[internalKey],
			);
			values[internalKey] = client
				.send(command)
				.catch((e) => catchInvalidSignatureException(e, client, command))
				.then((resp) => ({
					schemaVersionId: resp.SchemaVersionId,
					schemaDefinition: resp.SchemaDefinition,
					dataFormat: resp.DataFormat,
				}))
				.catch((e) => {
					// Copy rather than mutate in place, so the cache is only updated
					// through `modifyCache` and its refresh timer is rescheduled with it.
					const value = { ...getCache(options.cacheKey).value };
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

	const glueSchemaRegistryMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const glueSchemaRegistryMiddlewareBefore = (request) => {
		if (client) return glueSchemaRegistryMiddlewareFetch(request);
		clientInit ??= createClient(options, request);
		return clientInit.then((resolvedClient) => {
			client = resolvedClient;
			return glueSchemaRegistryMiddlewareFetch(request);
		});
	};

	return {
		before: glueSchemaRegistryMiddlewareBefore,
	};
};

const schemaVersionIdPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const resolveSchemaVersion = async (
	schemaVersionId,
	options,
	request,
) => {
	if (
		typeof schemaVersionId !== "string" ||
		!schemaVersionIdPattern.test(schemaVersionId)
	) {
		throw new TypeError("resolveSchemaVersion: schemaVersionId required", {
			cause: { package: pkg, data: { schemaVersionId } },
		});
	}
	const merged = { ...defaults, ...options };
	const cacheKey = `${merged.cacheKey}:${schemaVersionId}`;
	const baseExpiry = merged.cacheKeyExpiry?.[merged.cacheKey];
	const cacheKeyExpiry =
		// Stryker disable next-line ConditionalExpression: equivalent — when baseExpiry is undefined the else branch yields {...merged.cacheKeyExpiry, [cacheKey]: undefined}, and processCache reads `cacheKeyExpiry?.[cacheKey] ?? cacheExpiry`, so undefined collapses to the same cacheExpiry as the then branch
		baseExpiry === undefined
			? merged.cacheKeyExpiry
			: { ...merged.cacheKeyExpiry, [cacheKey]: baseExpiry };
	const cacheOptions = {
		cacheKey,
		cacheExpiry: merged.cacheExpiry,
		cacheKeyExpiry,
	};

	let client;
	const ensureClient = async () => {
		if (client) return client;
		// Stryker disable next-line ConditionalExpression: equivalent (forcing the else) — with no awsClientAssumeRole, createClient(merged, request) merges an empty credential set and delegates to createPrefetchClient with identical awsClientOptions, producing the same client as the then branch
		if (canPrefetch(merged)) {
			client = createPrefetchClient(merged);
		} else {
			client = await createClient(merged, request);
		}
		return client;
	};

	const fetchRequest = () => {
		const command = new GetSchemaVersionCommand({
			SchemaVersionId: schemaVersionId,
		});
		return {
			[schemaVersionId]: ensureClient()
				.then((c) =>
					c
						.send(command)
						.catch((e) => catchInvalidSignatureException(e, c, command)),
				)
				.then((resp) => ({
					schemaVersionId: resp.SchemaVersionId,
					schemaDefinition: resp.SchemaDefinition,
					dataFormat: resp.DataFormat,
				}))
				.catch((e) => {
					// This cacheKey is per schema version, so the entry holds only
					// this id. Dropping it outright is equivalent to blanking the
					// single key, and leaves nothing for the next call to reuse.
					clearCache([cacheKey]);
					throw e;
				}),
		};
	};

	const { value } = processCache(cacheOptions, fetchRequest);
	return value[schemaVersionId];
};

// Used for TS type inference (see index.d.ts)
export function glueSchemaRegistryParam(name) {
	return name;
}

export default glueSchemaRegistryMiddleware;
