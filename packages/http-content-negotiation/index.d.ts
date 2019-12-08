import middy from '@middy/core'

interface IHTTPContentNegotiationOptions {
  parseCharsets?: boolean;
  availableCharsets?: string[];
  parseEncodings?: boolean;
  availableEncodings?: string[];
  parseLanguages?: boolean;
  availableLanguages?: string[];
  parseMediaTypes?: boolean;
  availableMediaTypes?: string[];
  failOnMismatch?: boolean;
}

declare const httpContentNegotiation : middy.Middleware<IHTTPContentNegotiationOptions, any, any>

export default httpContentNegotiation
