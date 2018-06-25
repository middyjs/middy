module.exports = (opts) => {
  const defaults = {
    logger: data => console.log(JSON.stringify(data, null, 2))
  }

  const options = Object.assign({}, defaults, opts)

  return ({
    before: (handler, next) => {
      if (typeof options.logger === 'function') {
        options.logger({ event: handler.event })
      }

      return next()
    },
    after: (handler, next) => {
      if (typeof options.logger === 'function') {
        options.logger({ response: handler.response })
      }

      return next()
    }
  })
}
