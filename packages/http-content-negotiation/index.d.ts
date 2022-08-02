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

export type Event = {
  preferredCharsets: string[]
  preferredCharset: string
  preferredEncodings: string[]
  preferredEncoding: string
  preferredLanguages: string[]
  preferredLanguage: string
  preferredMediaTypes: string[]
  preferredMediaType: string
}

declare function httpContentNegotiation(
  options?: Options
): middy.MiddlewareObj<Event>

export default httpContentNegotiation
