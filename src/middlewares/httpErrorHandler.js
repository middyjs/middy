const { HttpError } = require('http-errors')

module.exports = () => ({
  onError: (handler, next) => {
    if (handler.error instanceof HttpError) {
      handler.response = {
        statusCode: handler.error.statusCode,
        body: handler.error.message
      }

      return next()
    }

    return next(handler.error)
  }
})
