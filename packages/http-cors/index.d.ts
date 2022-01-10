import middy from '@middy/core'

interface Options {
  getOrigin?: (incommingOrigin: string, options: Options) => string
  credentials?: boolean | string
  headers?: string
  methods?: string
  origin?: string
  origins?: string[]
  exposeHeaders?: string
  maxAge?: number | string
  requestHeaders?: string
  requestMethods?: string
  cacheControl?: string
}

declare function httpCors(options?: Options): middy.MiddlewareObj

export default httpCors
