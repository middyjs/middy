import middy from '@middy/core'
import {Context as LambdaContext} from 'aws-lambda'

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
  expose: boolean
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

type InternalOutput<TVariables> = TVariables extends string[] ? { [key in TVariables[number]]: unknown } : never

// NOTE: The following type definition is imperfect but it works for the most common use cases.
// `getInternal()` is a polymorphic function with a very dynamic return type, so it's challenging to map its full
// behaviour correctly to TypeScript types.
// Some Things that are currently missing that might be achievable with some high degree of TypeScript wizardry:
// - The remapping function can do nested remapping if using a dot syntax such as
//   `property.subproperty`. This will currently be typed as `unknown`
// - If internal contains a promise, the return value should be the resolved version of
//   that promise (right now it keeps the promise).
//
// single variable

type Flattened<T> = T extends Array<infer U> ? Flattened<U> : T;

// finds TKey in TInternal, recursively, even if it's a deeply nested one
type Resolve<TInternal, TKey> = TKey extends keyof TInternal
  ? TInternal[TKey]
  : TKey extends string
  ? {
      [P in keyof TInternal]: TInternal[P] extends object
        ? Resolve<TInternal[P], TKey>
        : never;
    }[keyof TInternal]
  : never;

// for when TVars is an object, find all keys in TInternal that match the values in TVars
type DeepResolve<TInternal, TVars> = {
  [P in keyof TVars]: Resolve<TInternal, TVars[P]>;
};

// Resolves all the promises recursively
type DeepAwaited<TInternal> = {
  [P in keyof TInternal]:
    TInternal[P] extends Promise<infer R>
    ? R // if it's a Promise resolve
    : TInternal[P] extends object // if it's an object recurse all it's properties
    ? DeepAwaited<TInternal[P]>
    : TInternal[P] // otherwise just use the value as is
}

// all possible shapes that TVars can have (this is based on your declarations)
type TVars<T, K> = true | keyof T | (keyof T)[] | Record<string, K>;

// all possible return values that getInternal() can produce (also based on your declaration)
type TGetInternalResults<TVars, TInternal> =
  TVars extends keyof TInternal
  ? { [P in TVars]: Awaited<TInternal[TVars]> }
  : TVars extends Array<keyof TInternal | string>
  ? {[P in Flattened<TVars>]: P extends keyof TInternal ? Awaited<TInternal[P]> : unknown}
  : TVars extends object
  ? DeepResolve<TInternal, TVars>  // <-- this is for the mapped case
  : DeepAwaited<TInternal>;  // <-- this is for the "true" case


// "K extends string" seems useless but it isn't. Without it, the (nested) mapped case doesn't work
// I removed "TInternal extends Record<string, unknown>" part because it doesn't do anything useful in my examples.
declare function getInternal<
  TContext extends LambdaContext,
  TInternal extends Record<string, unknown>,
  K extends string,
  T extends TVars<TInternal, K>
>(
  variables: T,
  request: middy.Request<unknown, unknown, unknown, TContext, TInternal>
): Promise<TGetInternalResults<T, TInternal>>

declare function sanitizeKey (key: string): string

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
