import { jsonSafeParse, jsonSafeStringify } from '@middy/util'

const defaults = {
  logger: console.log,
  awsContext: false,
  omitPaths: [],
  mask: undefined,
  replacer: undefined
}

const inputOutputLoggerMiddleware = (opts = {}) => {
  const { logger, awsContext, omitPaths, mask, replacer } = {
    ...defaults,
    ...opts
  }

  if (typeof logger !== 'function') {
    throw new Error(
      '[input-output-logger-middleware]: logger must be a function'
    )
  }

  const omitPathTree = buildPathTree(omitPaths)
  const omitAndLog = (param, request) => {
    const message = { [param]: request[param] }

    if (awsContext) {
      message.context = pick(request.context, awsContextKeys)
    }

    const cloneMessage = jsonSafeParse(jsonSafeStringify(message, replacer)) // Full clone to prevent nested mutations
    omit(cloneMessage, { [param]: omitPathTree[param] })

    logger(cloneMessage)
  }

  const omit = (obj, pathTree = {}) => {
    if (Array.isArray(obj) && pathTree['[]']) {
      for (const value of obj) {
        omit(value, pathTree['[]'])
      }
    } else if (isObject(obj)) {
      for (const key in pathTree) {
        if (pathTree[key] === true) {
          if (mask) {
            obj[key] = mask
          } else {
            delete obj[key]
          }
        } else {
          omit(obj[key], pathTree[key])
        }
      }
    }
  }

  const inputOutputLoggerMiddlewareBefore = async (request) =>
    omitAndLog('event', request)
  const inputOutputLoggerMiddlewareAfter = async (request) =>
    omitAndLog('response', request)
  const inputOutputLoggerMiddlewareOnError = async (request) => {
    if (request.response === undefined) return
    return omitAndLog('response', request)
  }

  return {
    before: inputOutputLoggerMiddlewareBefore,
    after: inputOutputLoggerMiddlewareAfter,
    onError: inputOutputLoggerMiddlewareOnError
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

const buildPathTree = (paths) => {
  const tree = {}
  for (let path of paths.sort().reverse()) {
    // reverse to ensure conflicting paths don't cause issues
    if (!Array.isArray(path)) path = path.split('.')
    if (path.includes('__proto__')) continue
    path
      .slice(0) // clone
      .reduce((a, b, idx) => {
        if (idx < path.length - 1) {
          a[b] ??= {}
          return a[b]
        }
        a[b] = true
        return true
      }, tree)
  }
  return tree
}

const isObject = (value) =>
  value && typeof value === 'object' && value.constructor === Object

export default inputOutputLoggerMiddleware
