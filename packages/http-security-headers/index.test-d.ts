import { expectType } from 'tsd'
import middy from '@middy/core'
import httpSecurityHeaders from '.'

// use with default options
let middleware = httpSecurityHeaders()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = httpSecurityHeaders({
  dnsPrefetchControl: {
    allow: true
  },
  expectCT: {
    enforce: true,
    maxAge: 60 * 60 * 5,
    reportUri: 'http://example.com'
  },
  frameguard: {
    action: 'SAMEORIGIN'
  },
  hidePoweredBy: {
    setTo: 'middy'
  },
  hsts: {
    maxAge: 60 * 60 * 10,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: {
    action: 'noopen'
  },
  noSniff: {
    action: 'nosniff'
  },
  referrerPolicy: {
    policy: 'same-origin'
  },
  xssFilter: {
    reportUri: 'http://example.com'
  }
})
expectType<middy.MiddlewareObj>(middleware)
