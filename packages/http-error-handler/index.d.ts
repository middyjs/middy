import { HttpError } from 'http-errors'
import middy from '@middy/core'

interface IHTTPErrorHandlerOptions {
  logger?: (error: HttpError) => void;
}

declare const httpErrorHandler : middy.Middleware<IHTTPErrorHandlerOptions, any, any>

export default httpErrorHandler
