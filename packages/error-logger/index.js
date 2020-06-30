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

      // does not handle the error (keeps propagating it)
      return next(handler.error)
    }
  })
}
