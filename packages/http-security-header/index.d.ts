import middy from '@middy/core'

interface IHTTPSecurityHeadersOptions {
  dnsPrefetchControl?: {
    allow?: Boolean
  },
  expectCT?: {
    enforce?: Boolean,
    maxAge?: Number
  },
  frameguard?: {
    action?: String
  },
  hidePoweredBy?: {
    setTo: String
  },
  hsts?: {
    maxAge?: Number,
    includeSubDomains?: Boolean,
    preload?: Boolean
  },
  ieNoOpen?: {
    action?: String
  },
  noSniff?: {
    action?: String
  },
  referrerPolicy?: {
    policy?: String
  },
  xssFilter?: Object
}

declare const httpSecurityHeaders : middy.Middleware<IHTTPSecurityHeadersOptions, any, any>

export default httpSecurityHeaders
