import { HttpError } from 'http-errors'
import middy from '@middy/core'

interface IHTTPErrorHandlerOptions {
  logger?: (error: HttpError) => void;
}

declare function httpErrorHandler(opts?: IHTTPErrorHandlerOptions): middy.IMiddyMiddlewareObject;

export default httpErrorHandler
