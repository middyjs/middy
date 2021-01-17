//const { Agent } = require('https')
//const { NodeHttpHandler } = require('@aws-sdk/node-http-handler')
const { captureAWSClient } = require('aws-xray-sdk')

// Docs: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/enforcing-tls.html
const awsClientDefaultOptions = {
  // AWS SDK v3
  /*requestHandler: new NodeHttpHandler({
    httpsAgent: new Agent(
      {
        secureProtocol: 'TLSv1_2_method'
      }
    )
  })*/
}

const createPrefetchClient = (options) => {
  const awsClientOptions = Object.assign({}, awsClientDefaultOptions, options.awsClientOptions)
  const client = new options.AwsClient(awsClientOptions)

  // AWS XRay
  if (options.awsClientCapture) {
    return captureAWSClient(client)
  }

  return client
}

const createClient = async (options, handler) => {
  let awsClientCredentials = {}

  // Role Credentials
  if (options.awsClientAssumeRole) {
    if (!handler) throw new Error('Handler required when assuming role')
    awsClientCredentials = await getInternal({ credentials: options.awsClientAssumeRole }, handler)
  }

  awsClientCredentials = Object.assign({}, awsClientCredentials, options.awsClientOptions)

  return createPrefetchClient(Object.assign({}, options, { awsClientOptions: awsClientCredentials }))
}

const canPrefetch = (options) => {
  return (!options?.awsClientAssumeRole && !options?.disablePrefetch)
}

// Internal Context
const getInternal = async (variables, handler) => {
  if (!variables) return {}
  let keys = []
  let values = []
  if (variables === true) {
    keys = values = Object.keys(handler.internal)
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
    let valuePromise = handler.internal[rootOptionKey]
    if (typeof valuePromise?.then !== 'function') {
      valuePromise = Promise.resolve(valuePromise)
    }
    promises.push(
      valuePromise.then(value => pathOptionKey.reduce((p, c) => p?.[c], value))
    )
  }
  // ensure promise has resolved by the time it's needed
  values = await Promise.all(promises)

  return keys.reduce((obj, key, index) => ({ ...obj, [sanitizeKey(key)]: values[index] }), {})
}
const sanitizeKey = (key) => {
  return key
    .replace(/^([0-9])/, '_$1')
    .replace(/[^a-zA-Z0-9]+/g, '_')
}

// fetch Cache
const cache = {} // key: { value, expiry }
const processCache = (options, fetch = () => undefined, handler) => {
  if (options.cacheExpiry) {
    const cached = getCache(options.cacheKey)
    if (cached && (cache.expiry >= Date.now() || options.cacheExpiry < 0)) {
      return cached.value
    }
  }
  const value = fetch(handler)
  if (options.cacheExpiry) {
    cache[options.cacheKey] = {
      value,
      expiry: Date.now() + options.cacheExpiry
    }
  }
  return value
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
  try {
    return JSON.parse(string, reviver)
  } catch (e) {}

  return string
}

module.exports = { createPrefetchClient, createClient, canPrefetch, getInternal, sanitizeKey, processCache, getCache, clearCache, jsonSafeParse }
