import middy from '@middy/core'

interface Options {
  normalizeHeaderKey?: (key: string) => string
  canonical?: boolean
}

declare function httpHeaderNormalizer (options?: Options): middy.MiddlewareObj

export default httpHeaderNormalizer
