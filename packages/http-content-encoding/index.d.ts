import middy from '@middy/core'

interface Options {
  br?: any
  gzip?: any
  deflate?: any
  overridePreferredEncoding?: string[]
}

declare function httpContentEncoding (options?: Options): middy.MiddlewareObj

export default httpContentEncoding
