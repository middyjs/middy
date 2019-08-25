import middy from '@middy/core'

interface IHTTPPartialResponseOptions {
  filteringKeyName?: string;
}

declare function httpPartialResponse(opts?: IHTTPPartialResponseOptions): middy.IMiddyMiddlewareObject;

export default httpPartialResponse
