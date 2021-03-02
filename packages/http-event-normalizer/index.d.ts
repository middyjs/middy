import middy from '@middy/core'

interface Options {
  payloadFormatVersion?: 1 | 2
}

declare function httpEventNormalizer (options?: Options): middy.MiddlewareObj

export default httpEventNormalizer
