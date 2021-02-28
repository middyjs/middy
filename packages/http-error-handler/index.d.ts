import { HttpError } from 'http-errors'
import middy from '@middy/core'

interface IHttpErrorHandlerOptions {
  logger?: (error: HttpError) => void
  fallbackMessage?: string
}

declare const httpErrorHandler: middy.Middleware<IHttpErrorHandlerOptions, any, any>

export default httpErrorHandler
