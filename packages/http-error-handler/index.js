import { jsonSafeParse } from '../core/util.js'

const defaults = {
  logger: console.error,
  fallbackMessage: null
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const httpErrorHandlerMiddlewareOnError = async (handler) => {
    if (typeof options.logger === 'function') {
      options.logger(handler.error)
    }

    if (!handler.error.statusCode && options.fallbackMessage) {
      handler.error = {
        statusCode: 500,
        message: options.fallbackMessage
      }
    }

    handler.response.statusCode = handler.error.statusCode
    handler.response.body = jsonSafeParse(handler.error.message)
    handler.response.headers['Content-Type'] = typeof handler.response.body === 'string'
      ? 'plain/text'
      : 'application/json'

    // Send signal that error has been handled
    handler.error = null
  }

  return {
    onError: httpErrorHandlerMiddlewareOnError
  }
}
