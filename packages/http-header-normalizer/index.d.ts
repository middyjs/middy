import middy from '@middy/core'

interface Options {
  normalizeHeaderKey?: (key: string) => string
  canonical?: boolean
}

export interface Event {
  rawHeaders: Record<string, string>
}

declare function httpHeaderNormalizer (
  options?: Options
): middy.MiddlewareObj<Event>

export default httpHeaderNormalizer
