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
	setToContext?: boolean;
}

export declare class HttpError extends Error {
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

declare function normalizeHttpResponse(
	request: middy.Request,
	fallbackResponse?: Record<string, unknown>,
): Record<string, unknown>;

declare function createError(
	code: number,
	message: string,
	properties?: Record<string, unknown>,
): HttpError;

declare function modifyCache(cacheKey: string, value: unknown): void;

declare function catchInvalidSignatureException<Client, Command>(
	e: Error & { __type?: string },
	client: Client,
	command: Command,
): Promise<unknown>;

declare function jsonSafeStringify(
	value: unknown,
	replacer?: (key: string, value: unknown) => unknown,
	space?: string | number,
): string | unknown;

declare function decodeBody(event: {
	body?: string | null;
	isBase64Encoded?: boolean;
}): string | null | undefined;

declare const lambdaContextKeys: string[];

declare const executionContextKeys: string[];

declare function isExecutionModeDurable(context: LambdaContext): boolean;

declare function executionContext(
	request: middy.Request,
	key: string,
	context: LambdaContext,
): unknown;

declare function lambdaContext(
	request: middy.Request,
	key: string,
	context: LambdaContext,
): unknown;

declare const httpErrorCodes: Record<number, string>;
