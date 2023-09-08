import middy from '@middy/core'

type Flattened<T> = T extends Array<infer U> ? Flattened<U> : T

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
declare function getInternal<TInternal extends Record<string, unknown>, TVars extends keyof TInternal | string> (
  variables: TVars,
  request: middy.Request<any, any, any, any, TInternal>
): Promise<{
  [P in TVars]: (TVars extends keyof TInternal ? TInternal[TVars] : unknown)
}>
// array of variables
declare function getInternal<TInternal extends Record<string, unknown>, TVars extends Array<keyof TInternal | string>> (
  variables: TVars,
  request: middy.Request<any, any, any, any, TInternal>
): Promise<{
  [P in Flattened<TVars>]: (P extends keyof TInternal ? TInternal[P] : unknown)
}>
// mapping object
declare function getInternal<TInternal extends Record<string, unknown>, TMap extends Record<string, keyof TInternal | string>> (
  variables: TMap,
  request: middy.Request<any, any, any, any, TInternal>
): Promise<{
  [P in keyof TMap]: (TMap[P] extends keyof TInternal ? TInternal[TMap[P]] : unknown)
}>
// all variables (with true)
declare function getInternal<TInternal extends Record<string, unknown>> (
  variables: true,
  request: middy.Request<any, any, any, any, TInternal>
): Promise<{
  [P in keyof TInternal]: TInternal[P]
}>

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
