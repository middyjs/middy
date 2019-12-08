import middy from '@middy/core'

interface IHTTPPartialResponseOptions {
  filteringKeyName?: string;
}

declare const httpPartialResponse : middy.Middleware<IHTTPPartialResponseOptions, any, any>

export default httpPartialResponse
