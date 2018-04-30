import middy from '../core'

interface IHTTPPartialResponseOptions {
  filteringKeyName?: string;
}

declare function httpPartialResponse(opts?: IHTTPPartialResponseOptions): middy.IMiddyMiddlewareObject;

export default httpPartialResponse
