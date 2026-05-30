// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	DescribeSecretCommand,
	GetSecretValueCommand,
	SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import {
	assignSetToContext,
	buildSetToContextSpec,
	canPrefetch,
	catchInvalidSignatureException,
	clearCache,
	createClient,
	createPrefetchClient,
	getCache,
	jsonSafeParse,
	modifyCache,
	processCache,
	validateOptions,
} from "@middy/util";

const name = "secrets-manager";
const pkg = `@middy/${name}`;

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
	cacheExpiry: -1, // with fetchRotationDate: -1 expires at NextRotationDate; >=0 adds to the last change date, capped at NextRotationDate
	setToContext: false,
};

const optionSchema = {
	type: "object",
	properties: {
		AwsClient: { instanceof: "Function" },
		awsClientOptions: { type: "object" },
		awsClientAssumeRole: { type: "string" },
		awsClientCapture: { instanceof: "Function" },
		fetchData: {
			type: "object",
			additionalProperties: { type: "string" },
		},
		fetchRotationDate: {
			oneOf: [
				{ type: "boolean" },
				{ type: "object", additionalProperties: { type: "boolean" } },
			],
		},
		disablePrefetch: { type: "boolean" },
		cacheKey: { type: "string" },
		cacheKeyExpiry: {
			type: "object",
			additionalProperties: { type: "number", minimum: -1 },
		},
		cacheExpiry: { type: "number", minimum: -1 },
		setToContext: { type: "boolean" },
	},
	additionalProperties: false,
};

export const secretsManagerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const secretsManagerMiddleware = (opts = {}) => {
	const options = {
		...defaults,
		...opts,
		cacheKeyExpiry: { ...defaults.cacheKeyExpiry, ...opts.cacheKeyExpiry },
	};

	const fetchDataKeys = Object.keys(options.fetchData);
	const contextSpec = buildSetToContextSpec(options);

	// AWS SDK v3 unmarshals DescribeSecret timestamps (NextRotationDate,
	// LastRotationDate, LastChangedDate) to Date objects. `Number(date)` yields
	// epoch milliseconds directly, so no per-second-to-ms conversion is needed.
	const toMs = (date) => (date ? Number(date) : 0);

	// processCache resolves a per-key expiry override by `options.cacheKey`
	// (not by the internal fetch key), so the rotation expiry must be written
	// under `options.cacheKey` BEFORE the cache entry is stored. We pick the
	// soonest expiry across all fetched secrets so the shared cache entry is
	// refreshed as soon as any secret is due to rotate.
	const fetchRotationDates = async () => {
		const pending = [];
		for (const internalKey of fetchDataKeys) {
			const fetchRotation =
				options.fetchRotationDate === true ||
				options.fetchRotationDate?.[internalKey];
			if (!fetchRotation) continue;

			const command = new DescribeSecretCommand({
				SecretId: options.fetchData[internalKey],
			});
			pending.push(
				client
					.send(command)
					.catch((e) => catchInvalidSignatureException(e, client, command)),
			);
		}
		// Stryker disable next-line ConditionalExpression: equivalent - when pending is empty the remaining loop is a no-op and expiry stays undefined, so skipping the early return produces the identical result
		if (!pending.length) return;

		let expiry;
		for (const resp of await Promise.all(pending)) {
			let keyExpiry;
			if (options.cacheExpiry < 0) {
				if (resp.NextRotationDate) {
					keyExpiry = toMs(resp.NextRotationDate);
				}
			} else {
				const lastChanged =
					Math.max(toMs(resp.LastRotationDate), toMs(resp.LastChangedDate)) +
					options.cacheExpiry;
				keyExpiry = resp.NextRotationDate
					? Math.min(lastChanged, toMs(resp.NextRotationDate))
					: lastChanged;
			}

			if (keyExpiry !== undefined) {
				expiry = expiry === undefined ? keyExpiry : Math.min(expiry, keyExpiry);
			}
		}
		// Stryker disable next-line ConditionalExpression: equivalent - reaching here with expiry===undefined writes `undefined`, which is read back via `cacheKeyExpiry?.[cacheKey] ?? cacheExpiry`, identical to not writing at all
		if (expiry !== undefined) {
			options.cacheKeyExpiry[options.cacheKey] = expiry;
		}
	};

	const fetchRequest = (request, cachedValues = {}) => {
		const values = {};

		for (const internalKey of fetchDataKeys) {
			if (cachedValues[internalKey]) continue;

			const fetchSecret = () => {
				const command = new GetSecretValueCommand({
					SecretId: options.fetchData[internalKey],
				});
				return client
					.send(command)
					.catch((e) => catchInvalidSignatureException(e, client, command))
					.then((resp) => jsonSafeParse(resp.SecretString));
			};

			values[internalKey] = fetchSecret().catch((e) => {
				const value = getCache(options.cacheKey).value ?? {};
				value[internalKey] = undefined;
				modifyCache(options.cacheKey, value);
				throw e;
			});
		}
		return values;
	};

	// Equivalent mutant: forcing rotationEnabled true still no-ops because
	// cacheUnexpired() gates refreshRotationExpiry and fetchRotationDates does
	// nothing without rotation keys; clearCache only ever touches an
	// already-expired entry that processCache would refetch regardless.
	// Stryker disable next-line ConditionalExpression
	const rotationEnabled =
		// Stryker disable next-line ConditionalExpression
		options.fetchRotationDate === true ||
		fetchDataKeys.some((key) => options.fetchRotationDate?.[key]);

	// True when the stored cache entry is still within its expiry window, so the
	// rotation DescribeSecret call can be skipped on a cache hit.
	const cacheUnexpired = () => {
		const cached = getCache(options.cacheKey);
		return !!cached.expiry && cached.expiry > Date.now();
	};

	// Refresh the rotation-derived expiry before processCache so it governs the
	// cache entry (processCache reads the override by `options.cacheKey`). The
	// stale entry is evicted first so processCache stores a fresh value under the
	// new expiry rather than reusing the old value masked by a future override.
	const refreshRotationExpiry = async () => {
		if (!rotationEnabled || cacheUnexpired()) return;
		clearCache([options.cacheKey]);
		await fetchRotationDates();
	};

	let client;
	let clientInit;
	if (canPrefetch(options)) {
		client = createPrefetchClient(options);
		fetchRotationDates()
			.then(() => processCache(options, fetchRequest))
			.catch(() => {});
	}

	const secretsManagerMiddlewareBefore = async (request) => {
		if (!client) {
			clientInit ??= createClient(options, request);
			client = await clientInit;
		}

		await refreshRotationExpiry();

		const { value } = processCache(options, fetchRequest, request);

		Object.assign(request.internal, value);

		if (contextSpec) {
			const pending = assignSetToContext(contextSpec, value, request);
			// Stryker disable next-line ConditionalExpression: equivalent - pending is either a Promise (awaited under both) or undefined, and `await undefined` resolves immediately with no observable effect
			if (pending) await pending;
		}
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
