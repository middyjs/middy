
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
        body: handler.error.message
      }
    }
  }

  return {
    onError: httpErrorHandlerMiddlewareOnError
  }
}
