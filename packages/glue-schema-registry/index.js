// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { GetSchemaVersionCommand, GlueClient } from "@aws-sdk/client-glue";
import {
	canPrefetch,
	catchInvalidSignatureException,
	createClient,
	createPrefetchClient,
	getCache,
	getInternal,
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
	fetchData: {}, // { contextKey: { SchemaVersionId } | { SchemaId, SchemaVersionNumber } }
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
		disablePrefetch: { type: "boolean" },
		cacheKey: { type: "string" },
		cacheKeyExpiry: {
			type: "object",
			additionalProperties: { type: "number", minimum: -1 },
		},
		cacheExpiry: { type: "number", minimum: -1 },
		setToContext: { type: "boolean" },
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
							SchemaVersionNumber: { type: "integer", minimum: 1 },
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

const buildSlot = (resolvedEntries) => {
	const schemas = new Map();
	let schema;
	for (const entry of resolvedEntries) {
		if (!entry?.schemaVersionId) continue;
		schemas.set(entry.schemaVersionId, {
			schemaDefinition: entry.schemaDefinition,
			dataFormat: entry.dataFormat,
		});
		schema = entry.schemaDefinition;
	}
	return { schemas, schema };
};

const glueSchemaRegistryMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		fetchData: structuredClone({ ...defaults.fetchData, ...opts.fetchData }),
	};

	const fetchDataKeys = Object.keys(options.fetchData);
	const fetch = (request, cachedValues = {}) => {
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
		processCache(options, fetch);
	}

	const glueSchemaRegistryMiddlewareBefore = async (request) => {
		if (!client) {
			clientInit ??= createClient(options, request);
			client = await clientInit;
		}

		const { value } = processCache(options, fetch, request);

		// Sts/s3-style: each fetchData key as its own request.internal entry
		Object.assign(request.internal, value);

		// Resolve all entries (warm cache: synchronous; cold: awaited) and
		// build the consolidated slot for event-batch-parser parser fallback.
		const resolved = await Promise.all(
			fetchDataKeys.map((k) => Promise.resolve(value[k])),
		);
		request.internal[pkg] = buildSlot(resolved);

		if (options.setToContext) {
			const data = await getInternal(fetchDataKeys, request);
			Object.assign(request.context, data);
		}
	};

	return {
		before: glueSchemaRegistryMiddlewareBefore,
	};
};

export const resolveSchemaVersion = async (
	schemaVersionId,
	options,
	request,
) => {
	if (typeof schemaVersionId !== "string" || schemaVersionId.length === 0) {
		throw new TypeError("resolveSchemaVersion: schemaVersionId required");
	}
	const merged = { ...defaults, ...options };
	const cacheKey = `${merged.cacheKey}:${schemaVersionId}`;
	const cacheOptions = {
		cacheKey,
		cacheExpiry: merged.cacheExpiry,
		cacheKeyExpiry: merged.cacheKeyExpiry,
	};

	let client;
	const ensureClient = async () => {
		if (client) return client;
		if (canPrefetch(merged)) {
			client = createPrefetchClient(merged);
		} else {
			client = await createClient(merged, request);
		}
		return client;
	};

	const fetch = () => {
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
					const v = getCache(cacheKey).value ?? {};
					v[schemaVersionId] = undefined;
					modifyCache(cacheKey, v);
					throw e;
				}),
		};
	};

	const { value } = processCache(cacheOptions, fetch);
	const resolved = await value[schemaVersionId];

	request.internal[pkg] ??= { schemas: new Map(), schema: undefined };
	const slot = request.internal[pkg];
	slot.schemas.set(resolved.schemaVersionId, {
		schemaDefinition: resolved.schemaDefinition,
		dataFormat: resolved.dataFormat,
	});
	slot.schema = resolved.schemaDefinition;
	return resolved;
};

// Used for TS type inference (see index.d.ts)
export function glueSchemaRegistryParam(name) {
	return name;
}

export default glueSchemaRegistryMiddleware;
