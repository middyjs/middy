import middy from '../core'

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

declare function httpContentNegotiation(opts?: IHTTPContentNegotiationOptions): middy.IMiddyMiddlewareObject;

export default httpContentNegotiation
