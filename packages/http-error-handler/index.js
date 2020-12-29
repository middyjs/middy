import { jsonSafeParse } from '../core/util.js'

const defaults = {
  logger: console.error
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const httpErrorHandlerMiddlewareOnError = async (handler) => {
    // if there are a `statusCode` and an `error` field
    // this is a valid http error object
    if (handler.error.statusCode && handler.error.message) {
      if (typeof options.logger === 'function') {
        options.logger(handler.error)
      }

      handler.response = {
        statusCode: handler.error.statusCode,
        body: jsonSafeParse(handler.error.message)
      }
      handler.response.headers['Content-Type'] = typeof handler.response.body === 'string'
        ? 'plain/text'
        : 'application/json'
    }
  }

  return {
    onError: httpErrorHandlerMiddlewareOnError
  }
}
