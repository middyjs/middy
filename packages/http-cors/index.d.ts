import middy from '@middy/core'

interface IHttpCorsOptions {
  credentials?: string,
  headers?: string,
  methods?: string,
  origin?: string,
  origins?: string[],
  exposeHeaders?: string,
  maxAge?: string,
  requestHeaders?: string,
  requestMethods?: string,
  cacheControl?: string,
}

declare const httpCors : middy.Middleware<IHttpCorsOptions, any, any>

export default httpCors
