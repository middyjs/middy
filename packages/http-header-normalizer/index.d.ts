import middy from '@middy/core'

interface IHttpHeaderNormalizerOptions {
  normalizeHeaderKey?: (key: string) => string;
  canonical?: Boolean;
}

declare const httpHeaderNormalizer : middy.Middleware<IHttpHeaderNormalizerOptions, any, any>

export default httpHeaderNormalizer
