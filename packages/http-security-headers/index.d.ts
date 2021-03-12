import middy from '@middy/core'

interface Options {
  dnsPrefetchControl?: {
    allow?: boolean
  }
  expectCT?: {
    enforce?: boolean
    maxAge?: number
    reportUri?: string
  }
  frameguard?: {
    action?: string
  }
  hidePoweredBy?: {
    setTo: string
  }
  hsts?: {
    maxAge?: number
    includeSubDomains?: boolean
    preload?: boolean
  }
  ieNoOpen?: {
    action?: string
  }
  noSniff?: {
    action?: string
  }
  referrerPolicy?: {
    policy?: string
  }
  xssFilter?: {
    reportUri?: string
  }
}

declare function httpSecurityHeaders (options?: Options): middy.MiddlewareObj

export default httpSecurityHeaders
