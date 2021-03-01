import middy from '@middy/core'

interface Options {
  parseCharsets?: boolean
  availableCharsets?: string[]
  parseEncodings?: boolean
  availableEncodings?: string[]
  parseLanguages?: boolean
  availableLanguages?: string[]
  parseMediaTypes?: boolean
  availableMediaTypes?: string[]
  failOnMismatch?: boolean
}

declare function httpContentNegotiation (options?: Options): middy.MiddlewareObj

export default httpContentNegotiation
