const omit = require('lodash/omit')

module.exports = (opts) => {
  const defaults = {
    logger: data => console.log(JSON.stringify(data, null, 2)),
    omitPaths: []
  }

  const { logger, omitPaths } = Object.assign({}, defaults, opts)

  const cloneMessage = message => JSON.parse(JSON.stringify(message))

  const omitAndLog = message => {
    const messageClone = cloneMessage(message)
    const redactedMessage = omit(messageClone, omitPaths)
    logger(redactedMessage)
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
