import AWS from 'aws-sdk'
import { captuteAWSClient } from 'aws-xray-sdk'
import { Handler } from 'aws-lambda'

interface Options {
  AwsClient?: AWS
  awsClientOptions?: Partial<AWS.Types.ClientConfiguration>
  awsClientAssumeRole?: string
  awsClientCapture?: captuteAWSClient
  fetchData?: { [key: string]: string }
  disablePrefetch?: boolean
  cacheKey?: string
  cacheExpiry?: number
  setToEnv?: boolean
  setToContext?: boolean
}

declare function createPrefetchClient (options: Options): AWS

declare function createClient (options: Options, handler: Handler): AWS

declare function canPrefetch (options: Options): boolean

declare function getInternal (variables: any, handler: Handler): Promise<object>

declare function sanitizeKey (key: string): string

declare function processCache (options: Options, fetch: (handler: Handler) => any, handler: Handler): { value: any, expiry: number }

declare function getCache (keys: string): any

declare function clearCache (keys?: string | string[] | null): void

declare function jsonSafeParse (string: string, reviver?: (key: string, value: any) => any): any

declare function normalizeHttpResponse (response: any, fallbackResponse?: any): any
