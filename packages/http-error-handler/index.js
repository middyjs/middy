const { jsonSafeParse, normalizeHttpResponse } = require('@middy/util')

const defaults = {
  logger: console.error,
  fallbackMessage: null
}

module.exports = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const httpErrorHandlerMiddlewareOnError = async (handler) => {
    if (typeof options.logger === 'function') {
      options.logger(handler.error)
    }

    // Set default expose value, only passes in when there is an override
    if (handler.error?.statusCode && handler.error?.expose === undefined) {
      handler.error.expose = handler.error.statusCode < 500
    }

    // Non-http error OR expose set to false
    if (options.fallbackMessage && (!handler.error?.statusCode || !handler.error?.expose)) {
      handler.error = {
        statusCode: 500,
        message: options.fallbackMessage,
        expose: true
      }
    }

    if (handler.error?.expose) {
      handler.response = normalizeHttpResponse(handler.response)
      handler.response.statusCode = handler.error?.statusCode
      handler.response.body = jsonSafeParse(handler.error?.message)
      handler.response.headers['Content-Type'] = typeof handler.response?.body === 'string'
        ? 'plain/text'
        : 'application/json'

      return handler.response
    }
  }

  return {
    onError: httpErrorHandlerMiddlewareOnError
  }
}
