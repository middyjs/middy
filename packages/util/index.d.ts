// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { Context as LambdaContext } from "aws-lambda";
import type {
	ArrayValues,
	Choose,
	DeepAwaited,
	IsUnknown,
	SanitizeKey,
	SanitizeKeys,
} from "./type-utils.d.ts";

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
	awsClientCapture?: (service: Client) => Client;
	fetchData?: { [key: string]: string };
	disablePrefetch?: boolean;
	cacheKey?: string;
	cacheExpiry?: number;
	cacheKeyExpiry?: Record<string, number>;
	/**
	 * Absolute expiries (unix ms) recorded by `setCacheKeyExpiry`, kept apart
	 * from the user-facing `cacheKeyExpiry`. Managed by the middleware.
	 */
	cacheLearnedExpiry?: Record<string, number | undefined>;
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
	constructor(code: number, properties?: Record<string, unknown>);
	status: number;
	statusCode: number;
	expose: boolean;
	[key: string]: unknown;
	[key: number]: unknown;
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

declare function processCache<Client, ClientOptions>(
	options: Options<Client, ClientOptions>,
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

declare function normalizeHttpResponse(
	request: Request,
	fallbackResponse?: Record<string, unknown>,
): Record<string, unknown>;

/**
 * A compiled `omitPaths` lookup. `true` marks a leaf to remove or mask; `[]`
 * is the segment used to descend into array elements.
 */
export type PathTree = Map<string, PathTree | true>;

declare function buildPathTree(
	paths: ReadonlyArray<string | string[]>,
): PathTree;

/**
 * Returns `value` unchanged when no `pathTree` entry applies; otherwise a
 * shallow clone with the matched leaves removed, or replaced by `mask`.
 * `Error` values are normalized to a plain object first, so non-enumerable
 * properties such as `cause` and `stack` are still reachable by path. Plain
 * objects and arrays are walked in place; a class instance (the durable
 * execution `context`) is walked through a copy of its own properties when a
 * path reaches into it, and built-ins such as `Date`, `Map`, `Set`, `Buffer`
 * and streams are never opened.
 */
declare function omit<T>(value: T, pathTree?: PathTree, mask?: string): T;

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
		"cacheKey" | "cacheExpiry" | "cacheKeyExpiry" | "cacheLearnedExpiry"
	>,
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

declare function isExecutionModeDurable(context: LambdaContext): boolean;

export type JsonSchemaType =
	| "string"
	| "number"
	| "integer"
	| "boolean"
	| "object"
	| "array";

export type StringRule = {
	type: "string";
	pattern?: string;
	minLength?: number;
	maxLength?: number;
	enum?: readonly string[];
	examples?: readonly string[];
};

export type NumberRule = {
	type: "number" | "integer";
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number;
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
	uniqueItems?: boolean;
	examples?: readonly unknown[];
};

export type ObjectRule = {
	type: "object";
	required?: readonly string[];
	properties?: { [key: string]: OptionSchemaRule };
	additionalProperties?: boolean | OptionSchemaRule;
	examples?: readonly object[];
};

export type EnumRule = {
	enum: readonly unknown[];
	type?: JsonSchemaType;
	examples?: readonly unknown[];
};

export type ConstRule = {
	const: unknown;
	examples?: readonly unknown[];
};

export type InstanceofRule = {
	instanceof: string;
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
	| ArrayRule
	| ObjectRule
	| EnumRule
	| ConstRule
	| InstanceofRule
	| OneOfRule
	| AllOfRule;

export type OptionSchema = ObjectRule;

export declare function validateOptions(
	packageName: string,
	schema: OptionSchema,
	options?: Record<string, unknown>,
): void;
