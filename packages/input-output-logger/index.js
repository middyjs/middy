
const defaults = {
  logger: (data) => console.log(JSON.stringify(data, null, 2)),
  awsContext: false,
  omitPaths: []
}

const inputOutputLoggerMiddleware = (opts = {}) => {
  let { logger, awsContext, omitPaths } = { ...defaults, ...opts }
  if (typeof logger !== 'function') logger = null

  const omitAndLog = (param, request) => {
    const message = {
      [param]: request[param]
    }
    if (awsContext) {
      message.context = pick(request.context, awsContextKeys)
    }
    const redactedMessage = omit(JSON.parse(JSON.stringify(message)), omitPaths) // Full clone to prevent nested mutations
    logger(redactedMessage)
  }

  const inputOutputLoggerMiddlewareBefore = async (request) =>
    omitAndLog('event', request)
  const inputOutputLoggerMiddlewareAfter = async (request) =>
    omitAndLog('response', request)
  const inputOutputLoggerMiddlewareOnError = inputOutputLoggerMiddlewareAfter
  return {
    before: logger ? inputOutputLoggerMiddlewareBefore : undefined,
    after: logger ? inputOutputLoggerMiddlewareAfter : undefined,
    onError: logger ? inputOutputLoggerMiddlewareOnError : undefined
  }
}

// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html
const awsContextKeys = [
  'functionName',
  'functionVersion',
  'invokedFunctionArn',
  'memoryLimitInMB',
  'awsRequestId',
  'logGroupName',
  'logStreamName',
  'identity',
  'clientContext',
  'callbackWaitsForEmptyEventLoop'
]

// move to util, if ever used elsewhere
const pick = (originalObject = {}, keysToPick = []) => {
  const newObject = {}
  for (const path of keysToPick) {
    // only supports first level
    if (originalObject[path] !== undefined) {
      newObject[path] = originalObject[path]
    }
  }
  return newObject
}
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
