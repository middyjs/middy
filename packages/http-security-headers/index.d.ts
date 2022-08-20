import middy from '@middy/core'

interface Options {
  dnsPrefetchControl?: {
    allow?: boolean
  }
  frameOptions?: {
    action?: string
  }
  poweredBy?: {
    server: string
  }
  strictTransportSecurity?: {
    maxAge?: number
    includeSubDomains?: boolean
    preload?: boolean
  }
  downloadOptions?: {
    action?: string
  }
  contentTypeOptions?: {
    action?: string
  }
  originAgentCluster?: boolean
  referrerPolicy?: {
    policy?: string
  }
  xssProtection?: {
    reportUri?: string
  }
}

type WithFalseValues<T> = { [K in keyof T]: T[K] | false }

declare function httpSecurityHeaders(
  options?: WithFalseValues<Options>
): middy.MiddlewareObj

export default httpSecurityHeaders
