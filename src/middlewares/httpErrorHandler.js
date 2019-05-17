module.exports = (opts) => {
  const defaults = {
    logger: console.error
  }

  const options = Object.assign({}, defaults, opts)

  return ({
    onError: (handler, next) => {
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

        return next()
      }

      return next(handler.error)
    }
  })
}
