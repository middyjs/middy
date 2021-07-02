const { Agent } = require('https')
// const { NodeHttpHandler } = require('@aws-sdk/node-http-handler') // aws-sdk v3

const awsClientDefaultOptions = {
  // AWS SDK v3
  // Docs: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/enforcing-tls.html
  /* requestHandler: new NodeHttpHandler({
    httpsAgent: new Agent(
      {
        secureProtocol: 'TLSv1_2_method'
      }
    )
  }) */
  // Docs: https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/enforcing-tls.html
  httpOptions: {
    agent: new Agent({
      secureProtocol: 'TLSv1_2_method'
    })
  }
}

const createPrefetchClient = (options) => {
  const awsClientOptions = {
    ...awsClientDefaultOptions,
    ...options.awsClientOptions
  }
  const client = new options.AwsClient(awsClientOptions)

  // AWS XRay
  if (options.awsClientCapture) {
    return options.awsClientCapture(client)
  }

  return client
}

const createClient = async (options, request) => {
  let awsClientCredentials = {}

  // Role Credentials
  if (options.awsClientAssumeRole) {
    if (!request) throw new Error('Request required when assuming role')
    awsClientCredentials = await getInternal(
      { credentials: options.awsClientAssumeRole },
      request
    )
  }

  awsClientCredentials = {
    ...awsClientCredentials,
    ...options.awsClientOptions
  }

  return createPrefetchClient({
    ...options,
    awsClientOptions: awsClientCredentials
  })
}

const canPrefetch = (options) => {
  return !options?.awsClientAssumeRole && !options?.disablePrefetch
}

// Internal Context
const getInternal = async (variables, request) => {
  if (!variables || !request) return {}
  let keys = []
  let values = []
  if (variables === true) {
    keys = values = Object.keys(request.internal)
  } else if (typeof variables === 'string') {
    keys = values = [variables]
  } else if (Array.isArray(variables)) {
    keys = values = variables
  } else if (typeof variables === 'object') {
    keys = Object.keys(variables)
    values = Object.values(variables)
  }
  const promises = []
  for (const internalKey of values) {
    // 'internal.key.sub_value' -> { [key]: internal.key.sub_value }
    const pathOptionKey = internalKey.split('.')
    const rootOptionKey = pathOptionKey.shift()
    let valuePromise = request.internal[rootOptionKey]
    if (typeof valuePromise?.then !== 'function') {
      valuePromise = Promise.resolve(valuePromise)
    }
    promises.push(
      valuePromise.then((value) =>
        pathOptionKey.reduce((p, c) => p?.[c], value)
      )
    )
  }
  // ensure promise has resolved by the time it's needed
  // If one of the promises throws it will bubble up to @middy/core
  values = await Promise.allSettled(promises)
  const errors = values
    .filter((res) => res.status === 'rejected')
    .map((res) => res.reason.message)
  if (errors.length) throw new Error(JSON.stringify(errors))
  return keys.reduce(
    (obj, key, index) => ({ ...obj, [sanitizeKey(key)]: values[index].value }),
    {}
  )
}
const sanitizeKeyPrefixLeadingNumber = /^([0-9])/
const sanitizeKeyRemoveDisallowedChar = /[^a-zA-Z0-9]+/g
const sanitizeKey = (key) => {
  return key
    .replace(sanitizeKeyPrefixLeadingNumber, '_$1')
    .replace(sanitizeKeyRemoveDisallowedChar, '_')
}

// fetch Cache
const cache = {} // key: { value:{fetchKey:Promise}, expiry }
const processCache = (options, fetch = () => undefined, request) => {
  const { cacheExpiry, cacheKey } = options
  if (cacheExpiry) {
    const cached = getCache(cacheKey)
    const unexpired = cached && (cacheExpiry < 0 || cached.expiry > Date.now())

    if (unexpired && cached.modified) {
      const value = fetch(request, cached.value)
      cache[cacheKey] = {
        value: { ...cached.value, ...value },
        expiry: cached.expiry
      }
      return cache[cacheKey]
    }
    if (unexpired) {
      return { ...cached, cache: true }
    }
  }
  const value = fetch(request)

  const expiry = Date.now() + cacheExpiry
  if (cacheExpiry) {
    cache[cacheKey] = { value, expiry }
  }
  return { value, expiry }
}

const getCache = (key) => {
  return cache[key]
}

// Used to remove parts of a cache
const modifyCache = (cacheKey, value) => {
  if (!cache[cacheKey]) return
  cache[cacheKey] = { ...cache[cacheKey], value, modified: true }
}

const clearCache = (keys = null) => {
  keys = keys ?? Object.keys(cache)
  if (!Array.isArray(keys)) keys = [keys]
  for (const cacheKey of keys) {
    cache[cacheKey] = undefined
  }
}

const jsonSafeParse = (string, reviver) => {
  if (typeof string !== 'string') return string
  const firstChar = string[0]
  if (firstChar !== '{' && firstChar !== '[' && firstChar !== '"') return string
  try {
    return JSON.parse(string, reviver)
  } catch (e) {}

  return string
}

const normalizeHttpResponse = (response) => {
  // May require updating to catch other types
  if (response === undefined) {
    response = {}
  } else if (
    Array.isArray(response) ||
    typeof response !== 'object' ||
    response === null
  ) {
    response = { body: response }
  }
  response.headers = response?.headers ?? {}
  return response
}

// smaller version of `http-errors`
const statuses = require('./codes.json')
const { inherits } = require('util')

const createErrorRegexp = /[^a-zA-Z]/g
const createError = (code, message, properties = {}) => {
  const name = statuses[code].replace(createErrorRegexp, '')
  const className = name.substr(-5) !== 'Error' ? name + 'Error' : name

  function HttpError (message) {
    // create the error object
    const msg = message ?? statuses[code]
    const err = new Error(msg)

    // capture a stack trace to the construction point
    Error.captureStackTrace(err, HttpError)

    // adjust the [[Prototype]]
    Object.setPrototypeOf(err, HttpError.prototype)

    // redefine the error message
    Object.defineProperty(err, 'message', {
      enumerable: true,
      configurable: true,
      value: msg,
      writable: true
    })

    // redefine the error name
    Object.defineProperty(err, 'name', {
      enumerable: false,
      configurable: true,
      value: className,
      writable: true
    })

    return err
  }

  inherits(HttpError, Error)
  const desc = Object.getOwnPropertyDescriptor(HttpError, 'name')
  desc.value = className
  Object.defineProperty(HttpError, 'name', desc)

  Object.assign(HttpError.prototype, {
    status: code,
    statusCode: code,
    expose: code < 500
  }, properties)

  return new HttpError(message)
}

module.exports = {
  createPrefetchClient,
  createClient,
  canPrefetch,
  getInternal,
  sanitizeKey,
  processCache,
  getCache,
  modifyCache,
  clearCache,
  jsonSafeParse,
  normalizeHttpResponse,
  createError
}
