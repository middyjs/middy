import middy from '@middy/core'

interface IHTTPHeaderNormalizerOptions {
  normalizeHeaderKey?: (key: string) => string;
  canonical?: Boolean;
}

declare const httpHeaderNormalizer : middy.Middleware<IHTTPHeaderNormalizerOptions, any, any>

export default httpHeaderNormalizer
