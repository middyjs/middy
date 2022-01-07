const { jsonSafeParse, normalizeHttpResponse } = require('@middy/util')

const defaults = {
  logger: console.error,
  fallbackMessage: null
}

const httpErrorHandlerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const httpErrorHandlerMiddlewareOnError = async (request) => {
    if (request.response !== undefined) return
    if (typeof options.logger === 'function') {
      options.logger(request.error)
    }

    // Set default expose value, only passes in when there is an override
    if (request.error?.statusCode && request.error?.expose === undefined) {
      request.error.expose = request.error.statusCode < 500
    }

    // Non-http error OR expose set to false
    if (
      options.fallbackMessage &&
      (!request.error?.statusCode || !request.error?.expose)
    ) {
      request.error = {
        statusCode: 500,
        message: options.fallbackMessage,
        expose: true
      }
    }

    if (request.error?.expose) {
      normalizeHttpResponse(request)

      request.response = {
        ...request.response,
        statusCode: request.error.statusCode,
        body: request.error.message,
        headers: {
          ...request.response.headers,
          'Content-Type': typeof jsonSafeParse(request.error.message) === 'string'
            ? 'text/plain'
            : 'application/json'
        }
      }
    }
  }

  return {
    onError: httpErrorHandlerMiddlewareOnError
  }
}
module.exports = httpErrorHandlerMiddleware
