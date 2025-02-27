import middy from '@middy/core'

interface Options {
  canonical?: boolean
  defaultHeaders?: Record<string, string>
  normalizeHeaderKey?: (key: string) => string
}

export interface Event {}

declare function httpHeaderNormalizer(
  options?: Options
): middy.MiddlewareObj<Event>

export default httpHeaderNormalizer
