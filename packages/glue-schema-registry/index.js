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
		Object.assign(request.internal, value);
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
	return value[schemaVersionId];
};

// Used for TS type inference (see index.d.ts)
export function glueSchemaRegistryParam(name) {
	return name;
}

export default glueSchemaRegistryMiddleware;
