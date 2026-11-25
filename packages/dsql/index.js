// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	cacheOptionSchemaProperties,
	canPrefetch,
	clearCache,
	getCache,
	getInternal,
	isExecutionModeDurable,
	processCache,
	reservedPropertyNames,
	setContextNamespace,
	validateOptions,
} from "@middy/util";

const name = "dsql";
const pkg = `@middy/${name}`;

// A cluster endpoint "follows the format
// your_cluster_identifier.dsql.region.on.aws":
// https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_authentication-token.html
// Through AWS PrivateLink it is
// "{cluster-id}.{service-identifier}.{region}.on.aws", with an identifier
// "such as dsql-fnh4". Without private DNS the client connects to the "AWS
// PrivateLink endpoint's fully-qualified domain name or IP address", the
// domain name being for example
// vpce-04037adb76c111221-d849uc2p.dsql-fnh4.us-east-1.vpce.amazonaws.com:
// https://docs.aws.amazon.com/aurora-dsql/latest/userguide/privatelink-managing-clusters.html
const hostRegion = "[a-z]{2}-[a-z]+(-[a-z]+)?-\\d+";
const clusterHostPattern = `[a-z0-9]+\\.dsql(-[a-z0-9]+)?\\.${hostRegion}\\.on\\.aws`;
const vpcEndpointHostPattern = `vpce-[a-z0-9-]+\\.dsql-[a-z0-9]+\\.${hostRegion}\\.vpce\\.amazonaws\\.com`;
const ipv4Pattern = "\\d{1,3}(\\.\\d{1,3}){3}";
const ipv6Pattern = "([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}";
const matchWhole = (patterns) => `^(${patterns.join("|")})$`;
const privateLinkEndpointHostPattern = matchWhole([
	vpcEndpointHostPattern,
	ipv4Pattern,
	ipv6Pattern,
]);
const privateLinkEndpointHost = new RegExp(privateLinkEndpointHostPattern);

const fn = { $ref: "#/$defs/Function" };
const flag = { type: "boolean" };
const off = { type: "boolean", const: false };
const unset = { const: null };
const text = { type: "string", maxLength: 1024, pattern: /^[\x20-\x7E]*$/u };
const unicodeText = /^[\p{L}\p{N}\p{P}\p{S} ]+$/u;
// "By default, NAMEDATALEN is 64 so the maximum identifier length is 63 bytes."
// https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS
const identifier = { type: "string", maxLength: 63, pattern: unicodeText };
const role = { oneOf: [identifier, fn] };
const secret = {
	oneOf: [{ type: "string", maxLength: 1024, pattern: unicodeText }, fn],
};
// A domain name is "255 octets or less", 253 characters as text:
// https://www.rfc-editor.org/rfc/rfc1035#section-2.3.4
const maxHostnameLength = 253;
const hostname = {
	type: "string",
	maxLength: maxHostnameLength,
	pattern: /^[\x21-\x7E]+$/u,
};
const dsqlHost = {
	oneOf: [
		{
			type: "string",
			maxLength: maxHostnameLength,
			pattern: new RegExp(matchWhole([clusterHostPattern])),
		},
		{
			type: "string",
			maxLength: maxHostnameLength,
			pattern: privateLinkEndpointHost,
		},
	],
};
// "The application_name can be any string of less than NAMEDATALEN characters
// ... Only printable ASCII characters may be used":
// https://www.postgresql.org/docs/current/runtime-config-logging.html#GUC-APPLICATION-NAME
const applicationName = {
	type: "string",
	maxLength: 63,
	pattern: /^[\x20-\x7E]*$/u,
};
const count = (minimum) => ({
	type: "integer",
	minimum,
	maximum: Number.MAX_SAFE_INTEGER,
});
// Node runs a timer whose delay is "larger than 2147483647" after 1 ms:
// https://nodejs.org/api/timers.html#settimeoutcallback-delay-args
// PostgreSQL integer settings stop at the same INT_MAX.
const milliseconds = { type: "number", minimum: 0, maximum: 2147483647 };
const seconds = { type: "number", minimum: 0, maximum: 2147483 };
const settingInteger = { type: "integer", minimum: 0, maximum: 2147483647 };
const serverTimeout = { oneOf: [settingInteger, off] };
const secondsOrOff = { oneOf: [seconds, off, unset] };
const closed = (properties, required = []) => ({
	type: "object",
	properties,
	required,
	additionalProperties: false,
	unevaluatedProperties: false,
});
const map = (propertyNames, additionalProperties, properties = {}) => ({
	type: "object",
	properties,
	propertyNames,
	maxProperties: 1024,
	required: [],
	additionalProperties,
	unevaluatedProperties: false,
});

const caBundleMaxLength = 1_048_576;
const rdsSslOptions = closed({
	rejectUnauthorized: flag,
	ca: {
		type: "string",
		maxLength: caBundleMaxLength,
		pattern: /^[\x20-\x7E\t\n\r]*$/u,
	},
	servername: hostname,
	checkServerIdentity: fn,
});
// The ssl strings each driver reads: postgres.js modes from
// node_modules/postgres/types/index.d.ts (SSL), and pg's from
// node_modules/pg/lib/connection-parameters.js.
const sslMode = {
	type: "string",
	enum: [
		"require",
		"allow",
		"prefer",
		"verify-full",
		"disable",
		"no-verify",
		"true",
	],
};

// "The oid type is currently implemented as an unsigned four-byte integer":
// https://www.postgresql.org/docs/current/datatype-oid.html
const oid = { type: "integer", minimum: 0, maximum: 4294967295 };
const typeName = { type: "string", maxLength: 1024, pattern: unicodeText };
const oidOrName = { oneOf: [oid, typeName] };
const postgresType = closed({
	to: oidOrName,
	from: {
		oneOf: [
			oid,
			typeName,
			{
				type: "array",
				items: oidOrName,
				maxItems: 1024,
				uniqueItems: true,
				unevaluatedItems: false,
			},
		],
	},
	serialize: fn,
	parse: fn,
});
const transformFrom = { oneOf: [fn, closed({ from: fn })] };

// The union of the options each bundled adapter's driver reads:
// pg.Client: node_modules/pg/lib/connection-parameters.js and client.js
// pg.Pool: node_modules/pg-pool/index.js
// postgres.js: node_modules/postgres/types/index.d.ts (Options)
const connectionOptions = {
	host: dsqlHost,
	hostname: dsqlHost,
	port: { type: "integer", minimum: 1, maximum: 65535 },
	path: { type: "string", maxLength: 1024, pattern: /^\/[\x21-\x7E]*$/u },
	database: identifier,
	db: identifier,
	user: role,
	username: role,
	password: secret,
	pass: secret,
	connectionString: {
		type: "string",
		maxLength: 1024,
		pattern: /^[\x21-\x7E]+$/u,
	},
	options: text,
	ssl: { oneOf: [flag, sslMode, rdsSslOptions] },
	sslnegotiation: {
		oneOf: [{ type: "string", enum: ["postgres", "direct"] }, unset],
	},
	channel_binding: { type: "string", enum: ["disable", "prefer", "require"] },
	enableChannelBinding: flag,
	scramMaxIterations: settingInteger,
	client_encoding: { type: "string", maxLength: 1024, pattern: /^[\w-]+$/u },
	replication: { oneOf: [flag, { type: "string", const: "database" }] },
	application_name: applicationName,
	fallback_application_name: applicationName,
	statement_timeout: serverTimeout,
	lock_timeout: serverTimeout,
	idle_in_transaction_session_timeout: serverTimeout,
	query_timeout: { oneOf: [milliseconds, off] },
	connectionTimeoutMillis: milliseconds,
	keepAlive: flag,
	keepAliveInitialDelayMillis: milliseconds,
	binary: flag,
	pipeline: flag,
	Promise: fn,
	stream: fn,
	types: {
		oneOf: [
			closed({ getTypeParser: fn }, ["getTypeParser"]),
			map(
				{
					type: "string",
					maxLength: 1024,
					pattern: /^[A-Za-z_$][\w$]*$/u,
					not: { type: "string", enum: reservedPropertyNames },
				},
				postgresType,
			),
		],
	},
	max: count(1),
	min: count(0),
	poolSize: count(1),
	maxUses: count(1),
	idleTimeoutMillis: { oneOf: [milliseconds, unset] },
	maxLifetimeSeconds: seconds,
	allowExitOnIdle: flag,
	log: fn,
	Client: fn,
	onConnect: fn,
	verify: fn,
	max_pipeline: count(1),
	scheduler: flag,
	idle_timeout: secondsOrOff,
	connect_timeout: secondsOrOff,
	keep_alive: secondsOrOff,
	queue_timeout: seconds,
	cancel_timeout: seconds,
	timeout: seconds,
	max_lifetime: { oneOf: [seconds, off, unset, fn] },
	backoff: { oneOf: [flag, seconds, fn] },
	prepare: flag,
	no_prepare: flag,
	infer: flag,
	fetch_types: flag,
	eager_types: flag,
	onread: flag,
	unref_sockets: flag,
	onnotice: { oneOf: [off, fn] },
	onnotify: fn,
	onparameter: fn,
	onclose: fn,
	debug: { oneOf: [flag, fn] },
	socket: fn,
	transform: closed({
		undefined: {
			oneOf: [
				unset,
				{
					type: "string",
					maxLength: 1024,
					pattern: /^[\p{L}\p{N}\p{P}\p{S} ]*$/u,
				},
				{
					type: "number",
					minimum: Number.MIN_SAFE_INTEGER,
					maximum: Number.MAX_SAFE_INTEGER,
				},
				flag,
			],
		},
		json: flag,
		column: { oneOf: [fn, closed({ from: fn, to: fn })] },
		value: transformFrom,
		row: transformFrom,
	}),
	connection: map(
		{
			type: "string",
			maxLength: 1024,
			pattern: /^[A-Za-z_][\w.-]*$/u,
			not: { type: "string", enum: reservedPropertyNames },
		},
		{
			type: ["string", "number", "boolean"],
			maxLength: 1024,
			pattern: /^[\x20-\x7E]*$/u,
			minimum: Number.MIN_SAFE_INTEGER,
			maximum: Number.MAX_SAFE_INTEGER,
		},
		{
			application_name: applicationName,
			default_transaction_isolation: {
				type: "string",
				enum: [
					"read uncommitted",
					"read committed",
					"repeatable read",
					"serializable",
				],
			},
			default_transaction_read_only: flag,
			default_transaction_deferrable: flag,
			statement_timeout: settingInteger,
			lock_timeout: settingInteger,
			idle_in_transaction_session_timeout: settingInteger,
			idle_session_timeout: settingInteger,
			DateStyle: text,
			IntervalStyle: {
				type: "string",
				enum: ["postgres", "postgres_verbose", "sql_standard", "iso_8601"],
			},
			TimeZone: text,
		},
	),
	target_session_attrs: {
		oneOf: [
			{
				type: "string",
				enum: [
					"read-write",
					"read-only",
					"primary",
					"standby",
					"prefer-standby",
				],
			},
			unset,
		],
	},
	publications: {
		type: "string",
		maxLength: 1024,
		pattern: /^[\p{L}\p{N}_$,]+$/u,
	},
	// "Each replication slot has a name, which can contain lower-case letters,
	// numbers, and the underscore character":
	// https://www.postgresql.org/docs/current/warm-standby.html#STREAMING-REPLICATION-SLOTS-MANIPULATION
	slot: {
		oneOf: [{ type: "string", maxLength: 63, pattern: /^[a-z0-9_]+$/u }, unset],
	},
};

const keyName = {
	type: "string",
	maxLength: 1024,
	pattern: /^[\x21-\x7E]+$/u,
	not: { type: "string", enum: reservedPropertyNames },
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:dsql:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		client: fn,
		config: closed(connectionOptions, ["host"]),
		contextKey: keyName,
		internalKey: keyName,
		...cacheOptionSchemaProperties,
	},
	required: ["client", "config"],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const dsqlValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const defaults = {
	client: undefined,
	config: undefined,
	contextKey: name,
	internalKey: undefined,
	disablePrefetch: false,
	cacheKey: pkg,
	cacheKeyExpiry: {},
	cacheExpiry: -1,
};

const dsqlMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	// `processCache` honours the per-key override first; every lifetime check
	// below must see the same value it does.
	const cacheExpiry =
		options.cacheKeyExpiry?.[options.cacheKey] ?? options.cacheExpiry;
	if (typeof options.client !== "function") {
		throw new Error(
			options.client === undefined
				? "client option missing"
				: "client must be a function",
			{ cause: { package: pkg } },
		);
	}
	const { host, ssl } = { ...options.config };
	// "When connecting with your AWS PrivateLink endpoint's fully-qualified
	// domain name or IP address, the `verify-full` SSL mode is not supported."
	// https://docs.aws.amazon.com/aurora-dsql/latest/userguide/privatelink-managing-clusters.html#connecting-cluster-id-option
	if (ssl === undefined && privateLinkEndpointHost.test(host)) {
		throw new Error(
			`config.ssl must be set: AWS PrivateLink endpoint domain names and IP addresses, such as '${host}', do not support the verify-full SSL mode, and connecting through one requires the amzn-cluster-id connection option; for verify-full, connect to the cluster's private DNS hostname, '{cluster-id}.{service-identifier}.{region}.on.aws'`,
			{ cause: { package: pkg, data: { host } } },
		);
	}

	// "This token is used only for authenticating the connection", and it
	// "automatically expires in 15 minutes by default":
	// https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_authentication-token.html
	// A cached pool opens physical connections long after the token it was
	// built with has expired, so the driver is given a `password` function
	// instead of a string. pg and postgres.js call it for every connection they
	// open.
	let latestToken;
	const refreshToken = async (request) => {
		const { token } = await getInternal(
			{ token: options.internalKey },
			request,
		);
		if (token === undefined) {
			throw new Error(
				`internalKey '${options.internalKey}' not found; ensure @middy/dsql-signer runs before @middy/dsql`,
				{ cause: { package: pkg } },
			);
		}
		latestToken = token;
	};
	const config = options.internalKey
		? { ssl: true, ...options.config, password: () => latestToken }
		: { ssl: true, ...options.config };
	const connect = () => options.client(config);

	// Clients that leave the cache (replaced by a refresh, superseded after a
	// failed reconnect, or flagged broken) are closed once the invocations
	// holding them finish, so a refresh never kills a running query. Leases are
	// counted per client, so a retired client closes as soon as its own holders
	// release while newer clients stay open.
	const holders = new Map(); // request -> client
	const leases = new Map(); // client -> { count, retired }
	let live;
	const close = (client) => {
		Promise.try(() => client.end()).catch((e) => {
			console.error("%s: cleanup error: %s", pkg, e.message);
		});
	};
	const retire = (client) => {
		const held = leases.get(client);
		if (held === undefined) close(client);
		else held.retired = true;
	};
	const lease = (request, client) => {
		holders.set(request, client);
		const held = leases.get(client);
		if (held === undefined) leases.set(client, { count: 1, retired: false });
		else held.count += 1;
	};
	const release = (request) => {
		const client = holders.get(request);
		// An invocation whose connect failed holds nothing.
		if (client === undefined) return;
		holders.delete(request);
		const held = leases.get(client);
		held.count -= 1;
		if (held.count > 0) return;
		leases.delete(client);
		if (held.retired) close(client);
	};
	// Durable execution skips onError, so an invocation that threw never
	// released its lease. Invocations are sequential there, so every lease
	// still held when the next one starts belongs to a finished invocation.
	const reclaim = () => {
		for (const [request, client] of holders) {
			if (cacheExpiry === 0) close(client);
			release(request);
		}
	};
	// Make a freshly connected client the one the cache hands out, retiring
	// the previous one.
	const adopt = (client) => {
		if (live !== undefined) retire(live);
		live = client;
		return client;
	};

	const fetch = () => {
		const pending = Promise.try(connect).then(
			(client) => {
				if (cacheExpiry === 0) return client;
				const current = getCache(options.cacheKey).value;
				if (current === undefined || current === pending) {
					return adopt(client);
				}
				// Another connect replaced this entry while it was in flight (a
				// refresh timer, or a broken-client reconnect racing this one).
				// The cache owns that client, so hand it back and close this one;
				// keep this one only if that connect fails.
				return current.then(
					(cached) => {
						retire(client);
						return cached;
					},
					() => adopt(client),
				);
			},
			(e) => {
				// Drop the rejected promise so the next invocation reconnects
				// instead of replaying the failure for the life of the entry. A
				// connect that already replaced this one (a refresh timer, or a
				// broken-client reconnect racing it) owns the entry: leave it.
				if (getCache(options.cacheKey).value === pending) {
					clearCache(options.cacheKey);
				}
				throw e;
			},
		);
		return pending;
	};

	// canPrefetch runs first so a past cacheExpiry timestamp is rejected at
	// construction even when internalKey rules out prefetching.
	if (canPrefetch({ ...options, cacheExpiry }) && !options.internalKey) {
		processCache(options, fetch);
	}

	const connectCached = () => {
		const entry = processCache(options, fetch);
		if (options.internalKey) clearTimeout(getCache(options.cacheKey).refresh);
		return entry;
	};

	const dsqlMiddlewareBefore = async (request) => {
		if (isExecutionModeDurable(request?.context)) reclaim();
		if (options.internalKey) await refreshToken(request);
		const entry = connectCached();
		let client = await entry.value;
		if (client.broken) {
			// The adapter flagged an unexpected disconnect: drop the dead client
			// and reconnect now rather than hand it out again. When a concurrent
			// invocation already replaced the entry, join its reconnect instead
			// of starting a second one that would race it for the cache.
			if (
				cacheExpiry === 0 ||
				getCache(options.cacheKey).value === entry.value
			) {
				clearCache(options.cacheKey);
				retire(client);
				live = undefined;
			}
			client = await connectCached().value;
		}
		setContextNamespace(request, options.contextKey, client);
		lease(request, client);
	};
	const dsqlMiddlewareAfter = async (request) => {
		try {
			// End only the client this request leased: the namespace can
			// inherit an outer middy's client when this request never connected.
			if (cacheExpiry === 0) {
				await holders.get(request)?.end();
			}
		} catch (e) {
			console.error("%s: cleanup error: %s", pkg, e.message);
		}
		release(request);
	};
	const dsqlMiddlewareOnError = dsqlMiddlewareAfter;

	return {
		before: dsqlMiddlewareBefore,
		after: dsqlMiddlewareAfter,
		onError: dsqlMiddlewareOnError,
	};
};

export default dsqlMiddleware;
