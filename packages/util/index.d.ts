import middy from '@middy/core'
import { Context as LambdaContext } from 'aws-lambda'
import type {
  ArrayValues,
  Choose,
  DeepAwaited,
  IsUnknown,
  SanitizeKey,
  SanitizeKeys
} from './type-utils.d.ts'

interface Options<Client, ClientOptions> {
  AwsClient?: new (...[config]: [any] | any) => Client
  awsClientOptions?: Partial<ClientOptions>
  awsClientAssumeRole?: string
  awsClientCapture?: (service: Client) => Client
  fetchData?: { [key: string]: string }
  disablePrefetch?: boolean
  cacheKey?: string
  cacheExpiry?: number
  setToContext?: boolean
}

declare class HttpError extends Error {
  status: number
  statusCode: number
  expose: boolean;
  [key: string]: any
  [key: number]: any
}

declare function createPrefetchClient<Client, ClientOptions> (
  options: Options<Client, ClientOptions>
): Client

declare function createClient<Client, ClientOptions> (
  options: Options<Client, ClientOptions>,
  request: middy.Request
): Promise<Client>

declare function canPrefetch<Client, ClientOptions> (
  options: Options<Client, ClientOptions>
): boolean

type InternalOutput<TVariables> = TVariables extends string[]
  ? { [key in TVariables[number]]: unknown }
  : never

// get an empty object if false is passed
declare function getInternal<
  TContext extends LambdaContext,
  TInternal extends Record<string, unknown>
> (
  variables: false,
  request: middy.Request<unknown, unknown, unknown, TContext, TInternal>
): Promise<{}>

// get all internal values if true is passed (with promises resolved)
declare function getInternal<
  TContext extends LambdaContext,
  TInternal extends Record<string, unknown>
> (
  variables: true,
  request: middy.Request<unknown, unknown, unknown, TContext, TInternal>
): Promise<DeepAwaited<TInternal>>

// get a single value
declare function getInternal<
  TContext extends LambdaContext,
  TInternal extends Record<string, unknown>,
  TVars extends keyof TInternal | string
> (
  variables: TVars,
  request: middy.Request<unknown, unknown, unknown, TContext, TInternal>
): TVars extends keyof TInternal
  ? Promise<DeepAwaited<{ [_ in SanitizeKey<TVars>]: TInternal[TVars] }>>
  : TVars extends string
    ? IsUnknown<Choose<DeepAwaited<TInternal>, TVars>> extends true
      ? unknown // could not find the path
      : Promise<{
        [_ in SanitizeKey<TVars>]: Choose<DeepAwaited<TInternal>, TVars>
      }>
    : unknown // path is not a string or a keyof TInternal

// get multiple values
declare function getInternal<
  TContext extends LambdaContext,
  TInternal extends Record<string, unknown>,
  TVars extends Array<keyof TInternal | string>
> (
  variables: TVars,
  request: middy.Request<unknown, unknown, unknown, TContext, TInternal>
): Promise<
SanitizeKeys<{
  [TVar in ArrayValues<TVars>]: TVar extends keyof TInternal
    ? DeepAwaited<TInternal[TVar]>
    : TVar extends string
      ? Choose<DeepAwaited<TInternal>, TVar>
      : unknown // path is not a string or a keyof TInternal
}>
>

// remap object
declare function getInternal<
  TContext extends LambdaContext,
  TInternal extends Record<string, unknown>,
  TMap extends Record<string, keyof TInternal | string>
> (
  variables: TMap,
  request: middy.Request<unknown, unknown, unknown, TContext, TInternal>
): Promise<{
  [P in keyof TMap]: TMap[P] extends keyof TInternal
    ? DeepAwaited<TInternal[TMap[P]]>
    : TMap[P] extends string
      ? Choose<DeepAwaited<TInternal>, TMap[P]>
      : unknown // path is not a string or a keyof TInternal
}>

declare function sanitizeKey<T extends string> (key: T): SanitizeKey<T>

declare function processCache<Client, ClientOptions> (
  options: Options<Client, ClientOptions>,
  fetch: (request: middy.Request, cachedValues: any) => any,
  request?: middy.Request
): { value: any, expiry: number }

declare function getCache (keys: string): any

declare function clearCache (keys?: string | string[] | null): void

declare function jsonSafeParse (
  string: string,
  reviver?: (key: string, value: any) => any
): any

declare function normalizeHttpResponse (
  request: any,
  fallbackResponse?: any
): any

declare function createError (
  code: number,
  message: string,
  properties?: Record<string, any>
): HttpError

declare function modifyCache (cacheKey: string, value: any): void
