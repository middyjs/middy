module.exports = (opts) => {
  const defaults = {
    logger: console.error
  }

  const options = Object.assign({}, defaults, opts)

  return ({
    onError: (handler, next) => {
      if (typeof options.logger === 'function') {
        options.logger(handler.error)
      }

      handler.response = handler.response || {}
      if (handler.error.constructor.super_ && handler.error.constructor.super_.name === 'HttpError') {
        handler.response = {
          statusCode: handler.error.statusCode,
          body: handler.error.message
        }

        return next()
      } else {
        handler.response.statusCode = 502
        handler.response.body = JSON.stringify({ message: 'Internal server error' })
      }

      return next(handler.error)
    }
  })
}
