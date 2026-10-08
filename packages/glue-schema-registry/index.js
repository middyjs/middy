// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { GetSchemaVersionCommand, GlueClient } from "@aws-sdk/client-glue";
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	catchInvalidSignatureException,
	createClientInit,
	createPrefetchClient,
	evictCacheOnFailure,
	getCache,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "glue-schema-registry";
// Matches the shared cache default in @middy/util.
const defaultCacheMaxSize = 128;
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
			additionalProperties: {
				type: "number",
				minimum: -1,
				maximum: Number.MAX_SAFE_INTEGER,
			},
		},
		cacheExpiry: {
			type: "number",
			minimum: -1,
			maximum: Number.MAX_SAFE_INTEGER,
		},
		cacheMaxSize: {
			type: "integer",
			minimum: 1,
			maximum: Number.MAX_SAFE_INTEGER,
		},
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

	const glueSchemaRegistryMiddlewareFetch = (request) => {
		const { value } = processCache(options, fetchRequest, request);
		Object.assign(request.internal, value);
		if (contextSpec) {
			return assignSetToContext(contextSpec, value, request);
		}
	};

	const glueSchemaRegistryMiddlewareBefore = (request) => {
		// With `awsClientAssumeRole` the client is rebuilt when sts refetches the
		// credentials, so it is resolved on every invocation.
		if (client && !options.awsClientAssumeRole) {
			return glueSchemaRegistryMiddlewareFetch(request);
		}
		return clientInit(request).then((resolvedClient) => {
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

const resolveClientInits = new WeakMap();

// Every schema version resolved under one cacheKey lives in a single entry of
// the shared cache (`${cacheKey}:schemaVersions`, one key per version), so a
// stream carrying many versions takes one slot of the global cacheMaxSize
// instead of evicting other middlewares' entries. Per cacheKey this tracks the
// ids held in that entry, oldest first (capped at cacheMaxSize), and the last
// client, which a background refresh (it has no invocation) reuses.
const resolveStates = new Map();

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
	const cacheKey = `${merged.cacheKey}:schemaVersions`;
	// A per-key expiry set on the base cacheKey applies to every version
	// resolved under it. processCache falls back to cacheExpiry when the
	// override is undefined. awsClientAssumeRole is passed so processCache skips
	// background refresh, which would reuse a client with stale credentials.
	const cacheOptions = {
		cacheKey,
		cacheExpiry: merged.cacheExpiry,
		cacheKeyExpiry: { [cacheKey]: merged.cacheKeyExpiry?.[merged.cacheKey] },
		awsClientAssumeRole: merged.awsClientAssumeRole,
	};

	// One client per options object, shared across schema versions. Without
	// awsClientAssumeRole, createClient is createPrefetchClient with the same
	// awsClientOptions, so one path serves both.
	// Calls without options all share the defaults, so they share a client.
	const clientKey = options ?? defaults;
	let clientInit = resolveClientInits.get(clientKey);
	if (clientInit === undefined) {
		clientInit = createClientInit(merged);
		resolveClientInits.set(clientKey, clientInit);
	}

	const cached = getCache(cacheKey).value;
	let state = resolveStates.get(cacheKey);
	// Nothing cached (first call, cleared, or caching disabled): start over, so
	// only this version is fetched.
	if (state === undefined || cached === undefined) {
		state = { ids: new Set(), client: undefined };
		resolveStates.set(cacheKey, state);
	}
	if (!state.ids.has(schemaVersionId)) {
		state.ids.add(schemaVersionId);
		let value = cached;
		if (state.ids.size > (merged.cacheMaxSize ?? defaultCacheMaxSize)) {
			const [oldest] = state.ids;
			state.ids.delete(oldest);
			value = Object.fromEntries(
				Object.entries(cached).filter(([id]) => id !== oldest),
			);
		}
		// Flag the entry modified so processCache fetches the versions it does
		// not hold yet, leaving the others cached.
		if (cached !== undefined) modifyCache(cacheKey, value);
	}

	const { ids } = state;
	const fetchRequest = (invocation, cachedValues = {}) => {
		if (invocation.internal !== undefined || state.client === undefined) {
			state.client = clientInit(invocation);
		}
		const values = {};
		for (const id of ids) {
			if (cachedValues[id]) continue;
			const command = new GetSchemaVersionCommand({ SchemaVersionId: id });
			values[id] = state.client
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
					// Stop tracking a version whose fetch failed, so later calls do
					// not refetch it; only while the entry still holds this fetch.
					if (getCache(cacheKey).value?.[id] === values[id]) ids.delete(id);
					return evictCacheOnFailure(cacheKey, id, values)(e);
				});
		}
		return values;
	};

	const { value } = processCache(cacheOptions, fetchRequest, request);
	return value[schemaVersionId];
};

// Used for TS type inference (see index.d.ts)
export function glueSchemaRegistryParam(name) {
	return name;
}

export default glueSchemaRegistryMiddleware;
