import { expectType } from 'tsd'
import middy from '@middy/core'
import httpCors from '.'

// use with default options
let middleware = httpCors()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = httpCors({
  credentials: true, // Access-Control-Allow-Credentials
  headers: 'X-Custom-Header, Upgrade-Insecure-Requests', // 'Access-Control-Allow-Headers',
  methods: 'POST, GET, OPTIONS', // 'Access-Control-Allow-Methods'
  origin: 'foo.bar.com',
  origins: ['foo.bar.com', 'foo.baz.com'],
  exposeHeaders: 'Content-Length, X-Kuma-Revision', // Access-Control-Expose-Headers
  maxAge: 600, // Access-Control-Max-Age
  requestHeaders: 'X-PINGOTHER, Content-Type', // Access-Control-Request-Headers
  requestMethods: 'POST', // Access-Control-Request-Methods
  cacheControl: 'proxy-revalidate', // Cache-Control
  getOrigin: (incomingOrigin) => {
    return incomingOrigin
  }
})
expectType<middy.MiddlewareObj>(middleware)
