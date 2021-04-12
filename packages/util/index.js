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
  if (!variables) return {}
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
  values = await Promise.all(promises)

  return keys.reduce(
    (obj, key, index) => ({ ...obj, [sanitizeKey(key)]: values[index] }),
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
const cache = {} // key: { value, expiry }
const processCache = (options, fetch = () => undefined, request) => {
  if (options.cacheExpiry) {
    const cached = getCache(options.cacheKey)
    if (cached && (cache.expiry >= Date.now() || options.cacheExpiry < 0)) {
      return { ...cached, cache: true }
    }
  }
  const value = fetch(request)
  const expiry = Date.now() + options.cacheExpiry
  if (options.cacheExpiry) {
    cache[options.cacheKey] = { value, expiry }
  }
  return { value, expiry }
}

const getCache = (key) => {
  return cache[key]
}

const clearCache = (keys = null) => {
  keys = keys ?? Object.keys(cache)
  if (!Array.isArray(keys)) keys = [keys]
  for (const cacheKey of keys) {
    delete cache[cacheKey]
  }
}

const jsonSafeParse = (string, reviver) => {
  if (typeof string !== 'string') return string
  const firstChar = string.substr(0, 1)
  if (firstChar !== '{' && firstChar !== '[' && firstChar !== '"') return string
  try {
    return JSON.parse(string, reviver)
  } catch (e) {}

  return string
}

const normalizeHttpResponse = (response, fallbackResponse = {}) => {
  response = response ?? fallbackResponse
  // May require updating to catch other types
  if (Array.isArray(response) || typeof response !== 'object') {
    response = { body: response }
  }
  response.headers = response?.headers ?? {}
  return response
}

module.exports = {
  createPrefetchClient,
  createClient,
  canPrefetch,
  getInternal,
  sanitizeKey,
  processCache,
  getCache,
  clearCache,
  jsonSafeParse,
  normalizeHttpResponse
}
