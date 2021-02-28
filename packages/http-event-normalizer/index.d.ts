import middy from '@middy/core'

interface IHttpEventNormalizerOptions {
  payloadFormatVersion?: number
}

declare const httpEventNormalizer: middy.Middleware<IHttpEventNormalizerOptions, any, any>

export default httpEventNormalizer
