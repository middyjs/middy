import omit from 'lodash.omit'

export default (opts = {}) => {
  const defaults = {
    logger: data => console.log(JSON.stringify(data, null, 2)),
    omitPaths: []
  }

  let { logger, omitPaths } = Object.assign({}, defaults, opts)

  const cloneMessage = message => JSON.parse(JSON.stringify(message))

  const omitAndLog = message => {
    const messageClone = cloneMessage(message)
    const redactedMessage = omit(messageClone, omitPaths)
    logger(redactedMessage)
  }

  if (typeof logger !== 'function') logger = ()=>{}

  return ({
    before: async (handler) => omitAndLog({ event: handler.event }),
    after: async (handler) => omitAndLog({ response: handler.response }),
    onError: async (handler) => omitAndLog({ response: handler.response })
  })
}
