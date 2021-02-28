import middy from '@middy/core'

interface IHttpPartialResponseOptions {
  filteringKeyName?: string
}

declare const httpPartialResponse: middy.Middleware<IHttpPartialResponseOptions, any, any>

export default httpPartialResponse
