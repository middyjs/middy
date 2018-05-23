import middy from '../core'

interface IHTTPHeaderNormalizerOptions {
  normalizeHeaderKey?: (key: string) => string;
  canonical?: Boolean;
}

declare function httpHeaderNormalizer(opts?: IHTTPHeaderNormalizerOptions): middy.IMiddyMiddlewareObject;

export default httpHeaderNormalizer
