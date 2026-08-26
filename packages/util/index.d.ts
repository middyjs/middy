// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type { Context as LambdaContext } from "aws-lambda";
import type {
	ArrayValues,
	Choose,
	DeepAwaited,
	IsUnknown,
	SanitizeKey,
	SanitizeKeys,
} from "./type-utils.d.ts";

export interface Options<Client, ClientOptions> {
	AwsClient?: new (config: ClientOptions) => Client;
	awsClientOptions?: Partial<ClientOptions>;
	awsClientAssumeRole?: string;
	awsClientCapture?: (service: Client) => Client;
	fetchData?: { [key: string]: string };
	disablePrefetch?: boolean;
	cacheKey?: string;
	cacheExpiry?: number;
	cacheKeyExpiry?: Record<string, number>;
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
	request: middy.Request,
): Promise<Client>;

declare function canPrefetch<Client, ClientOptions>(
	options: Options<Client, ClientOptions>,
): boolean;

// get an empty object if false is passed
declare function getInternal<
	TContext extends LambdaContext,
	TInternal extends Record<string, unknown>,
>(
	variables: false,
	request: middy.Request<unknown, unknown, unknown, TContext, TInternal>,
): Promise<{}>;

// get all internal values if true is passed (with promises resolved)
declare function getInternal<
	TContext extends LambdaContext,
	TInternal extends Record<string, unknown>,
>(
	variables: true,
	request: middy.Request<unknown, unknown, unknown, TContext, TInternal>,
): Promise<DeepAwaited<TInternal>>;

// get a single value
declare function getInternal<
	TContext extends LambdaContext,
	TInternal extends Record<string, unknown>,
	TVars extends keyof TInternal | string,
>(
	variables: TVars,
	request: middy.Request<unknown, unknown, unknown, TContext, TInternal>,
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
	request: middy.Request<unknown, unknown, unknown, TContext, TInternal>,
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
	request: middy.Request<unknown, unknown, unknown, TContext, TInternal>,
): Promise<{
	[P in keyof TMap]: TMap[P] extends keyof TInternal
		? DeepAwaited<TInternal[TMap[P]]>
		: TMap[P] extends string
			? Choose<DeepAwaited<TInternal>, TMap[P]>
			: unknown; // path is not a string or a keyof TInternal
}>;

declare function contextNamespace(
	request: middy.Request,
	contextKey: string,
): Record<string, unknown>;

declare function setContextNamespace(
	request: middy.Request,
	contextKey: string,
	value: unknown,
): void;

declare function sanitizeKey<T extends string>(key: T): SanitizeKey<T>;

declare function processCache<Client, ClientOptions>(
	options: Options<Client, ClientOptions>,
	fetch: (request: middy.Request, cachedValues: unknown) => unknown,
	request?: middy.Request,
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
	request: middy.Request,
	fallbackResponse?: Record<string, unknown>,
): Record<string, unknown>;

/**
 * A compiled `omitPaths` lookup. `true` marks a leaf to remove or mask; `[]`
 * is the segment used to descend into array elements.
 */
export type PathTree = { [segment: string]: PathTree | true };

declare function buildPathTree(
	paths: ReadonlyArray<string | string[]>,
): PathTree;

/**
 * Returns `value` unchanged when no `pathTree` entry applies; otherwise a
 * shallow clone with the matched leaves removed, or replaced by `mask`.
 * `Error` values are normalized to a plain object first, so non-enumerable
 * properties such as `cause` and `stack` are still reachable by path.
 */
declare function omit<T>(value: T, pathTree?: PathTree, mask?: string): T;

declare function modifyCache(cacheKey: string, value: unknown): void;

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

declare const executionContextKeys: string[];

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
