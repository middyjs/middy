// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type {
	ArrayValues,
	Choose,
	DeepAwaited,
	IsUnknown,
	SanitizeKey,
	SanitizeKeys,
} from "./type-utils.d.ts";

// import type { Context } from "aws-lambda";
// Structural copy of `Context` from @types/aws-lambda (MIT, DefinitelyTyped),
// kept local because @middy/util declares no dependencies. It must stay
// mutually assignable with the aws-lambda type (see index.tst.ts).
export interface LambdaContext {
	callbackWaitsForEmptyEventLoop: boolean;
	functionName: string;
	functionVersion: string;
	invokedFunctionArn: string;
	memoryLimitInMB: string;
	awsRequestId: string;
	logGroupName: string;
	logStreamName: string;
	identity?:
		| { cognitoIdentityId: string; cognitoIdentityPoolId: string }
		| undefined;
	clientContext?:
		| {
				client: {
					installationId: string;
					appTitle: string;
					appVersionName: string;
					appVersionCode: string;
					appPackageName: string;
				};
				custom?: any;
				env: {
					platformVersion: string;
					platform: string;
					make: string;
					model: string;
					locale: string;
				};
		  }
		| undefined;
	tenantId?: string | undefined;
	getRemainingTimeInMillis(): number;
	/** @deprecated Use handler callback or promise result */
	done(error?: Error, result?: any): void;
	/** @deprecated Use handler callback with first argument or reject a promise result */
	fail(error: Error | string): void;
	/** @deprecated Use handler callback with second argument or resolve a promise result */
	succeed(messageOrObject: any): void;
	/** @deprecated Use handler callback or promise result */
	succeed(message: string, object: any): void;
}

/**
 * The request the helpers receive, described structurally rather than
 * imported from `@middy/core`, which `@middy/util` declares no dependency on.
 * A `Request` satisfies it.
 */
export interface Request<
	TEvent = unknown,
	TResult = any,
	TErr = Error,
	TContext extends LambdaContext = LambdaContext,
	TInternal extends Record<string, unknown> = {},
> {
	event: TEvent;
	context: TContext & { middyContext: Record<string, unknown> };
	response: TResult | null | undefined;
	earlyResponse?: TResult | null | undefined;
	error: TErr | null | undefined;
	internal: TInternal;
}

export interface Options<Client, ClientOptions> {
	/**
	 * `NonNullable` so an SDK client, whose constructor takes an optional
	 * config, infers `ClientOptions` as the config type itself.
	 */
	AwsClient?: new (
		config: NonNullable<ClientOptions>,
	) => Client;
	awsClientOptions?: Partial<ClientOptions>;
	awsClientAssumeRole?: string;
	/**
	 * Wraps the client for tracing (`captureAWSv3Client`). Setting it turns
	 * prefetch off: X-Ray cannot record a request sent outside of an
	 * invocation, so the client is built and captured inside the first one.
	 */
	awsClientCapture?: (service: Client) => Client;
	fetchData?: { [key: string]: string };
	disablePrefetch?: boolean;
	cacheKey?: string;
	cacheExpiry?: number;
	cacheKeyExpiry?: Record<string, number>;
	/**
	 * Caps the number of entries in the one cache every middleware in the
	 * process shares (default 128), not this middleware's own entries. Storing
	 * an entry past the cap evicts the entry that expires soonest (the oldest
	 * inserted among equals), which may belong to another middleware; it is
	 * then refetched on its next use.
	 */
	cacheMaxSize?: number;
	setToContext?: boolean;
	contextKey?: string;
}

/**
 * Resolves the `context.middyContext` key a middleware writes to: the `contextKey`
 * option when set, otherwise the package name without the `@middy/` scope.
 */
export type ContextKey<
	TOptions,
	TDefaultKey extends string,
> = TOptions extends {
	contextKey: infer TKey extends string;
}
	? TKey
	: TDefaultKey;

/**
 * A Lambda context carrying one middleware's values under
 * `context.middyContext[contextKey]`.
 */
export type ContextNamespace<
	TOptions,
	TDefaultKey extends string,
	TValues,
> = LambdaContext & {
	middyContext: { [Key in ContextKey<TOptions, TDefaultKey>]: TValues };
};

export declare class HttpError extends Error {
	/**
	 * The message is always the reason phrase for `code`; put failure detail
	 * in `cause` (it stays server-side). `expose` defaults to `code < 500`.
	 */
	constructor(code: number, options?: { cause?: unknown; expose?: boolean });
	status: number;
	statusCode: number;
	expose: boolean;
	/**
	 * Response headers `http-error-handler` copies onto the error response
	 * (e.g. `WWW-Authenticate`). An array value is kept as multiple values on
	 * an ALB multi-value-headers response.
	 */
	headers?: Record<string, string | string[]>;
}

declare function createPrefetchClient<Client, ClientOptions>(
	options: Options<Client, ClientOptions>,
): Client;

declare function createClient<Client, ClientOptions>(
	options: Options<Client, ClientOptions>,
	request: Request,
): Promise<Client>;

/**
 * Memoized client initialisation for the warm path. A rejected attempt is
 * forgotten so the next invocation retries instead of replaying the failure.
 */
declare function createClientInit<Client, ClientOptions>(
	options: Options<Client, ClientOptions>,
): (request: Request) => Promise<Client>;

/**
 * Whether the middleware can fetch at construction: not with
 * `awsClientAssumeRole`, `awsClientCapture`, `disablePrefetch` or a
 * `cacheExpiry` of 0. Throws when the effective `cacheExpiry` can only be a
 * mistyped duration: above 86400000 (read as a unix timestamp) but before
 * 2001-01-01 (978307200000).
 */
declare function canPrefetch<Client, ClientOptions>(
	options: Options<Client, ClientOptions>,
): boolean;

// get an empty object if false is passed
declare function getInternal<
	TContext extends LambdaContext,
	TInternal extends Record<string, unknown>,
>(
	variables: false,
	request: Request<unknown, unknown, unknown, TContext, TInternal>,
): Promise<{}>;

// get all internal values if true is passed (with promises resolved)
declare function getInternal<
	TContext extends LambdaContext,
	TInternal extends Record<string, unknown>,
>(
	variables: true,
	request: Request<unknown, unknown, unknown, TContext, TInternal>,
): Promise<DeepAwaited<TInternal>>;

// get a single value
declare function getInternal<
	TContext extends LambdaContext,
	TInternal extends Record<string, unknown>,
	TVars extends keyof TInternal | string,
>(
	variables: TVars,
	request: Request<unknown, unknown, unknown, TContext, TInternal>,
): TVars extends keyof TInternal
	? Promise<DeepAwaited<{ [_ in SanitizeKey<TVars>]: TInternal[TVars] }>>
	: TVars extends string
		? IsUnknown<Choose<DeepAwaited<TInternal>, TVars>> extends true
			? unknown // could not find the path
			: Promise<{
					[_ in SanitizeKey<TVars>]: Choose<DeepAwaited<TInternal>, TVars>;
				}>
		: unknown; // path is not a string or a keyof TInternal

// get multiple values
declare function getInternal<
	TContext extends LambdaContext,
	TInternal extends Record<string, unknown>,
	TVars extends Array<keyof TInternal | string>,
>(
	variables: TVars,
	request: Request<unknown, unknown, unknown, TContext, TInternal>,
): Promise<
	SanitizeKeys<{
		[TVar in ArrayValues<TVars>]: TVar extends keyof TInternal
			? DeepAwaited<TInternal[TVar]>
			: TVar extends string
				? Choose<DeepAwaited<TInternal>, TVar>
				: unknown; // path is not a string or a keyof TInternal
	}>
>;

// remap object
declare function getInternal<
	TContext extends LambdaContext,
	TInternal extends Record<string, unknown>,
	TMap extends Record<string, keyof TInternal | string>,
>(
	variables: TMap,
	request: Request<unknown, unknown, unknown, TContext, TInternal>,
): Promise<{
	[P in keyof TMap]: TMap[P] extends keyof TInternal
		? DeepAwaited<TInternal[TMap[P]]>
		: TMap[P] extends string
			? Choose<DeepAwaited<TInternal>, TMap[P]>
			: unknown; // path is not a string or a keyof TInternal
}>;

declare function contextNamespace(
	request: Request,
	contextKey: string,
): Record<string, unknown>;

declare function setContextNamespace(
	request: Request,
	contextKey: string,
	value: unknown,
): void;

/**
 * The precomputed `setToContext` copy for a middleware's `fetchData` keys:
 * the target `contextKey` and the `[originalKey, sanitizedKey]` pairs.
 */
export type SetToContextSpec = {
	contextKey: string;
	pairs: Array<[string, string]>;
};

/**
 * Called once at factory time. Returns `null` when `setToContext` is off.
 * Throws a `TypeError` when two `fetchData` keys sanitize to the same name,
 * whether or not `setToContext` is on, since they would also collide in
 * `request.internal`.
 */
declare function buildSetToContextSpec(options: {
	fetchData: Record<string, unknown>;
	setToContext?: boolean;
	contextKey?: string;
}): SetToContextSpec | null;

/**
 * Called once per invocation. Returns `undefined` synchronously when every
 * value is already resolved, or a Promise when at least one is still pending.
 */
declare function assignSetToContext(
	spec: SetToContextSpec,
	value: Record<string, unknown>,
	request: Request,
): Promise<void> | undefined;

declare function sanitizeKey<T extends string>(key: T): SanitizeKey<T>;

/**
 * @internal Absolute expiries (unix ms) recorded by `setCacheKeyExpiry` on the
 * middleware's options object, kept apart from the user-facing
 * `cacheKeyExpiry` and read by `processCache`. Not a user option: every
 * package optionSchema rejects it.
 */
type CacheLearnedExpiryOptions = {
	cacheLearnedExpiry?: Record<string, number | undefined>;
};

/**
 * Serves `options.cacheKey` from the cache or calls `fetch(request)`. A
 * background refresh runs outside any invocation, so `fetch` then gets an
 * empty request, as on prefetch; the request is never kept with the entry.
 * A `fetch` closure that captures the request keeps it alive regardless, so
 * pass the request as the third argument rather than closing over it.
 * No background refresh is scheduled under `awsClientAssumeRole`: without a
 * request the client cannot pick up refetched credentials, so the entry
 * expires and the next invocation refetches.
 */
declare function processCache<Client, ClientOptions>(
	options: Options<Client, ClientOptions> & CacheLearnedExpiryOptions,
	fetch: (request: Request, cachedValues: unknown) => unknown,
	request?: Request,
): { value: unknown; expiry: number };

declare function getCache(keys: string): unknown;

declare function clearCache(keys?: string | string[] | null): void;

declare function jsonSafeParse(
	string: string,
	reviver?: (key: string, value: unknown) => unknown,
): unknown;

declare function jsonParseProtectProto(
	text: string,
	reviver?: (key: string, value: unknown) => unknown,
	packageName?: string,
): unknown;

/**
 * Whether `response` is a payload returned without the HTTP response wrapper:
 * it has no `statusCode`, `body` or `headers`, so the whole value is the body.
 * `undefined` and `null` count as unwrapped.
 */
declare function isUnwrappedHttpResponse(response: unknown): boolean;

declare function normalizeHttpResponse(
	request: Request,
): Record<string, unknown>;

/**
 * A compiled `omitPaths` lookup. `true` marks a leaf to remove or mask; `[]`
 * is the segment used to descend into array elements.
 */
export type PathTree = Map<string, PathTree | true>;

/**
 * One `omitPaths` entry, relative to the request. Keys match
 * case-insensitively.
 * - A string is dot-delimited (`event.headers.authorization`), and a `[]`
 *   segment selects every element of an array (`event.Records.[].body`). Any
 *   other use of `[`, `]` or `*`, or an all-digit segment, is rejected.
 * - An array lists the segments, each one a literal key, so a key that holds
 *   a dot, a bracket or a star stays addressable
 *   (`["event", "CodePipeline.job", "data"]`). `"[]"` still selects every
 *   element of an array. An array element cannot be selected by its index.
 */
export type OmitPath = string | ReadonlyArray<string>;

/**
 * Throws a `TypeError` for a path that could never match: an unsupported
 * string segment, an empty array path, a segment that is not a string, or a
 * `__proto__`, `constructor` or `prototype` segment. When two paths overlap,
 * the shorter one covers the longer.
 */
declare function buildPathTree(paths: ReadonlyArray<OmitPath>): PathTree;

/**
 * The option schema rule for `omitPaths`: an array whose entries are a string
 * or a non-empty array of strings. Pair it with `validateOmitPaths`, which
 * rejects the paths this shape lets through but that could never match.
 */
declare const omitPathsSchema: ArrayRule;

/**
 * The option schema rule for `awsClientOptions`: the config keys every AWS SDK
 * v3 client constructor shares, with providers, functions and instances as
 * `$ref` rules. Those resolve against the consuming schema's root, which must
 * declare `$defs: { Function: false, Object: false }`.
 */
declare const awsClientOptionsSchema: ObjectRule;

/**
 * The option schema rules for `disablePrefetch`, `cacheKey`, `cacheKeyExpiry`,
 * `cacheExpiry` and `cacheMaxSize`, to spread into a schema's `properties`.
 */
declare const cacheOptionSchemaProperties: {
	disablePrefetch: BooleanRule;
	cacheKey: StringRule;
	cacheKeyExpiry: ObjectRule;
	cacheExpiry: NumberRule;
	cacheMaxSize: NumberRule;
};

/**
 * Throws the `TypeError` `buildPathTree` would throw for `omitPaths`. Does
 * nothing for `undefined`.
 */
declare function validateOmitPaths(
	omitPaths: ReadonlyArray<OmitPath> | undefined,
): void;

/**
 * Whether `omit(value, pathTree)` removes or masks a string found in `value`
 * at `segments`: a path ends at it, ends above it, or continues into it (a
 * string has nothing below it to keep). Segments match case-insensitively, as
 * `omit` matches keys. `false` without a `pathTree`.
 */
declare function pathTreeOmitsString(
	pathTree: PathTree | undefined,
	segments: ReadonlyArray<string>,
): boolean;

/**
 * An `Error` after `omit` walked it: a plain object holding the error's own
 * properties (`message`, `stack`, `cause` and any added to it) and its
 * `name`. It is not an `instanceof Error` and has none of its methods.
 */
export type OmittedError = {
	name: string;
	message?: string;
	stack?: string;
	cause?: unknown;
	[key: string]: unknown;
};

/**
 * `T` as `omit` hands it back. An `Error` anywhere in it may have become an
 * `OmittedError`: always for the value passed in, and for a nested one when a
 * path leads into it. The types cannot follow which paths matched, so a
 * matched leaf keeps its declared type although it is absent, or holds the
 * mask, at run time.
 */
export type Omitted<T> = T extends Error
	? T | OmittedError
	: T extends (...args: never[]) => unknown
		? T
		: T extends object
			? { [K in keyof T]: Omitted<T[K]> }
			: T;

/**
 * Returns `value` unchanged when no `pathTree` entry applies; otherwise a
 * shallow clone with the matched leaves removed, or replaced by `mask`. A
 * path that ends in `[]` empties the array, or replaces every element by
 * `mask`.
 * `Error` values are normalized to a plain object first, so non-enumerable
 * properties such as `cause` and `stack` are still reachable by path. Plain
 * objects and arrays are walked in place; a class instance (the durable
 * execution `context`) is walked through a copy of its own properties when a
 * path reaches into it.
 * A path never leaves the value it names in the output. Where it cannot go
 * on, the value it stopped at is removed or masked whole: a string, a `Map`
 * or a `Set` the path continues into, and an array met by a key segment
 * instead of `[]`. A number, a boolean, `null` and `undefined` stay, since
 * nothing sits below them, and so do the other built-ins (`Date`, `Buffer`,
 * streams, promises), which are never opened. When the value passed in is
 * itself where a path stops, the result is `mask`, or `undefined` without one.
 */
declare function omit<T>(value: T): T;
declare function omit<T>(
	value: T,
	pathTree: PathTree | undefined,
	mask?: string,
): Omitted<T>;

declare function modifyCache(cacheKey: string, value: unknown): void;

/**
 * `.catch` handler for a per-key fetch: drops the failed key from the cached
 * value, flags the entry modified so only that key is refetched next time,
 * and rethrows. Pass the object the fetch returns as `values` so the key is
 * only dropped while the entry still holds that fetch's promise: a late
 * failure from a cycle a newer fetch has replaced then leaves the fresh value
 * intact.
 */
declare function evictCacheOnFailure(
	cacheKey: string,
	internalKey: string,
	values?: Record<string, unknown>,
): (e: unknown) => never;

/**
 * Records an absolute expiry (unix ms) learned from the fetched value in
 * `options.cacheLearnedExpiry`; `processCache` then expires the entry at the
 * sooner of it and the configured `cacheExpiry`. It never extends the
 * configured lifetime, never enables caching when it is disabled, and never
 * touches the user-facing `cacheKeyExpiry`. Several keys fetched in one
 * cycle keep the earliest expiry. A value that is not a unix timestamp
 * (`Infinity`, `NaN`, a duration, a negative number) is ignored.
 */
declare function setCacheKeyExpiry(
	options: Pick<
		Options<unknown, unknown>,
		"cacheKey" | "cacheExpiry" | "cacheKeyExpiry"
	> &
		CacheLearnedExpiryOptions,
	expiryMs: number,
): void;

declare function catchInvalidSignatureException<Client, Command>(
	e: Error & { __type?: string },
	client: Client,
	command: Command,
): Promise<unknown>;

declare function isJsonStructured(text: unknown): boolean;

declare const jsonContentTypePattern: RegExp;

declare function decodeBody(
	body: string | null | undefined,
	isBase64Encoded?: boolean,
): string | null | undefined;

declare const lambdaContextKeys: string[];

/**
 * Whether `context` is the durable execution context (`@middy/core` hands
 * middleware the SDK's `DurableContext` in durable mode), detected by its
 * brand. Any other value, including a plain Lambda context, is `false`.
 */
declare function isExecutionModeDurable(context: unknown): boolean;

/**
 * The API Gateway / VPC Lattice event version: an explicit `event.version`
 * wins (a VPC Lattice V2 event is `"2.0"`), otherwise `"vpc"` for a VPC
 * Lattice V1 event (one with `method`), else `"1.0"`.
 */
declare function resolveHttpEventVersion(event: object): string;

export type JsonSchemaType =
	| "string"
	| "number"
	| "integer"
	| "boolean"
	| "null"
	| "object"
	| "array";

export type StringRule = {
	type: "string";
	pattern?: RegExp;
	minLength?: number;
	maxLength?: number;
	enum?: readonly string[];
	not?: OptionSchemaRule;
	examples?: readonly string[];
};

export type NumberRule = {
	type: "number" | "integer";
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number;
	exclusiveMaximum?: number;
	enum?: readonly number[];
	examples?: readonly number[];
};

export type BooleanRule = {
	type: "boolean";
	enum?: readonly boolean[];
	examples?: readonly boolean[];
};

export type ArrayRule = {
	type: "array";
	items?: OptionSchemaRule;
	minItems?: number;
	maxItems?: number;
	uniqueItems?: boolean;
	unevaluatedItems?: false;
	examples?: readonly unknown[];
};

export type ObjectRule = {
	type: "object";
	required?: readonly string[];
	properties?: { [key: string]: OptionSchemaRule };
	additionalProperties?: boolean | OptionSchemaRule;
	unevaluatedProperties?: false;
	propertyNames?: OptionSchemaRule;
	patternProperties?: Record<string, OptionSchemaRule>;
	maxProperties?: number;
	examples?: readonly object[];
};

export type NullRule = {
	type: "null";
	examples?: readonly null[];
};

type TypeKeywords = "type" | "enum" | "examples";

/**
 * A value of any listed type. Each keyword constrains only the type it
 * targets, so `pattern` ignores a number and `minimum` ignores a string.
 */
export type TypeListRule = Omit<StringRule, TypeKeywords> &
	Omit<NumberRule, TypeKeywords> &
	Omit<ArrayRule, TypeKeywords> &
	Omit<ObjectRule, TypeKeywords> & {
		type: readonly JsonSchemaType[];
		enum?: readonly unknown[];
		examples?: readonly unknown[];
	};

export type EnumRule = {
	enum: readonly unknown[];
	type?: JsonSchemaType | readonly JsonSchemaType[];
	examples?: readonly unknown[];
};

export type ConstRule = {
	const: unknown;
	examples?: readonly unknown[];
};

export type RefRule = {
	$ref: `#/$defs/${string}`;
	examples?: readonly unknown[];
};

export type OneOfRule = {
	oneOf: readonly OptionSchemaRule[];
	examples?: readonly unknown[];
};

export type AllOfRule = {
	allOf: readonly OptionSchemaRule[];
	examples?: readonly unknown[];
};

export type OptionSchemaRule =
	| StringRule
	| NumberRule
	| BooleanRule
	| NullRule
	| ArrayRule
	| ObjectRule
	| TypeListRule
	| EnumRule
	| ConstRule
	| RefRule
	| OneOfRule
	| AllOfRule;

/**
 * The root of an option schema. `$defs` entries are `false` and named after a
 * global class; a `{ $ref: "#/$defs/<name>" }` rule checks
 * `instanceof globalThis[name]`.
 */
export type OptionSchema = ObjectRule & {
	$schema?: "https://json-schema.org/draft/2020-12/schema";
	$id?: string;
	$defs?: Record<string, false>;
};

/**
 * Keys that reach an object's prototype chain when assigned. Exclude them from
 * key names with `propertyNames: { ..., not: { type: "string", enum: reservedPropertyNames } }`.
 */
export declare const reservedPropertyNames: readonly string[];

/**
 * Validates `options` against `schema` and returns them. A rule is the
 * conjunction of its keywords: constraints written next to `const`, `enum`,
 * `oneOf`, `allOf`, `not` or `$ref` are checked too. A keyword outside
 * the rule types above throws a `TypeError` that names it and its option path,
 * whatever options are passed. `examples` and the root `$id` are the only
 * annotations accepted.
 */
export declare function validateOptions<
	TOptions extends Record<string, unknown> = Record<string, unknown>,
>(packageName: string, schema: OptionSchema, options?: TOptions): TOptions;
