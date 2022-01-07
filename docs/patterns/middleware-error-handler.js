const defaults = {
  logger: console.error
}

const errorHandlerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const errorHandlerMiddlewareMiddlewareOnError = async (request) => {
    if (request.response !== undefined) return
    if (typeof options.logger === 'function') {
      options.logger(request.error)
    }

    // ...

    request.response = {
      // ...
    }
  }

  return {
    onError: errorHandlerMiddlewareMiddlewareOnError
  }
}

module.exports = errorHandlerMiddleware
