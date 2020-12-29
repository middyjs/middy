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

  if (typeof logger !== 'function') logger = () => {}

  const inputOutputLoggerMiddlewareBefore = async (handler) => omitAndLog({ event: handler.event })
  const inputOutputLoggerMiddlewareAfter = async (handler) => omitAndLog({ response: handler.response })
  const inputOutputLoggerMiddlewareOnError = inputOutputLoggerMiddlewareAfter
  return ({
    before: inputOutputLoggerMiddlewareBefore,
    after: inputOutputLoggerMiddlewareAfter,
    onError: inputOutputLoggerMiddlewareOnError
  })
}
