const inputOutputLoggerMiddleware = (opts = {}) => {
  const defaults = {
    logger: (data) => console.log(JSON.stringify(data, null, 2)),
    omitPaths: []
  }

  let { logger, omitPaths } = { ...defaults, ...opts }
  if (typeof logger !== 'function') logger = null

  const omitAndLog = (message) => {
    const redactedMessage = omit(message, omitPaths)
    logger(redactedMessage)
  }

  const inputOutputLoggerMiddlewareBefore = async (handler) =>
    omitAndLog({ event: handler.event })
  const inputOutputLoggerMiddlewareAfter = async (handler) =>
    omitAndLog({ response: handler.response })
  const inputOutputLoggerMiddlewareOnError = inputOutputLoggerMiddlewareAfter
  return {
    before: logger ? inputOutputLoggerMiddlewareBefore : null,
    after: logger ? inputOutputLoggerMiddlewareAfter : null,
    onError: logger ? inputOutputLoggerMiddlewareOnError : null
  }
}

// move to util, if ever used elsewhere
const omit = (originalObject = {}, keysToOmit = []) => {
  const clonedObject = { ...originalObject }
  for (const path of keysToOmit) {
    deleteKey(clonedObject, path)
  }
  return clonedObject
}

const deleteKey = (obj, key) => {
  if (!Array.isArray(key)) key = key.split('.')
  const rootKey = key.shift()
  if (key.length && obj[rootKey]) {
    deleteKey(obj[rootKey], key)
  } else {
    delete obj[rootKey]
  }
  return obj
}

module.exports = inputOutputLoggerMiddleware
