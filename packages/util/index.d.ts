import AWS from 'aws-sdk'
import {captuteAWSClient} from 'aws-xray-sdk'
import {
  Context,
  Handler
} from 'aws-lambda'

interface IMiddlewareOptions {
  AwsClient?: AWS,
  awsClientOptions?: Partial<AWS.Types.ClientConfiguration>;
  awsClientAssumeRole?: string,
  awsClientCapture?: captuteAWSClient,
  fetchData?: { [key: string]: string; },
  disablePrefetch?: boolean,
  cacheKey?: string,
  cacheExpiry?: number,
  setToEnv?: boolean,
  setToContext?: boolean,
}

declare const createPrefetchClient: <IMiddlewareOptions> () => void

declare const createClient: <IMiddlewareOptions, Handler> () => void

declare const canPrefetch: <IMiddlewareOptions> () => boolean

declare const getInternal: <any, Handler> () => object

declare const sanitizeKey: <string> () => string

declare const processCache: <IMiddlewareOptions, () => void, Handler> () => any

declare const getCache: <string> () => object

declare const clearCache: <any> () => void

declare const jsonSafeParse: <any> () => any

declare const normalizeHttpResponse: <any> () => object



