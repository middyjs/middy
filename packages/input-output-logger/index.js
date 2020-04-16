import omit from 'lodash/omit'

module.exports = (opts) => {
  const defaults = {
    logger: data => console.log(JSON.stringify(data, null, 2)),
    exclude: []
  }

  const { logger, exclude } = Object.assign({}, defaults, opts)

  const omitAndLog = data => {
    const message = omit(data, exclude)
    logger(message)
  }

  return ({
    before: (handler, next) => {
      if (typeof logger === 'function') {
        omitAndLog({ event: handler.event })
      }

      return next()
    },
    after: (handler, next) => {
      if (typeof logger === 'function') {
        omitAndLog({ response: handler.response })
      }

      return next()
    }
  })
}
