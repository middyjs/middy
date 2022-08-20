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
  frameOptions: {
    action: 'SAMEORIGIN'
  },
  poweredBy: {
    server: 'middy'
  },
  strictTransportSecurity: {
    maxAge: 60 * 60 * 10,
    includeSubDomains: true,
    preload: true
  },
  downloadOptions: {
    action: 'noopen'
  },
  contentTypeOptions: {
    action: 'nosniff'
  },
  originAgentCluster: true,
  referrerPolicy: {
    policy: 'same-origin'
  },
  xssProtection: {
    reportUri: 'xss'
  }
})
expectType<middy.MiddlewareObj>(middleware)

// allow false options
middleware = httpSecurityHeaders({
  dnsPrefetchControl: false,
  frameOptions: false,
  poweredBy: false,
  strictTransportSecurity: false,
  downloadOptions: false,
  contentTypeOptions: false,
  originAgentCluster: false,
  referrerPolicy: false,
  xssProtection: false
})

expectType<middy.MiddlewareObj>(middleware)
