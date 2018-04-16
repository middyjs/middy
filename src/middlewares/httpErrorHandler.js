const { HttpError } = require('http-errors')

module.exports = () => ({
  onError: (handler, next) => {
    if (handler.error instanceof HttpError) {
      let body = handler.error.message
      if (handler.error.details) {
        body += `: ${handler.error.details}`
      }

      handler.response = {
        statusCode: handler.error.statusCode,
        body: body
      }

      return next()
    }

    return next(handler.error)
  }
})
