module.exports = (opts) => {
  const defaults = {
    logger: console.log
  }

  const options = Object.assign({}, defaults, opts)

  return ({
    before: (handler, next) => {
      if (typeof options.logger === 'function') {
        options.logger(handler.event)
      }

      return next()
    },
    after: (handler, next) => {
      if (typeof options.logger === 'function') {
        options.logger(handler.response)
      }

      return next()
    }
  })
}
