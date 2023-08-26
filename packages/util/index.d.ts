import middy from '@middy/core'

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

declare function getInternal (
  variables: any,
  request: middy.Request
): Promise<any>

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
