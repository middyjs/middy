import { Agent } from 'https'
import { NodeHttpHandler } from '@aws-sdk/node-http-handler'

// Docs: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/enforcing-tls.html
export const awsClientDefaultOptions = {
  requestHandler: new NodeHttpHandler({
    httpsAgent: new Agent(
      {
        secureProtocol: 'TLSv1_2_method'
      }
    )
  })
}

export const createClient = (options, handler) => {
  const awsClientConnectionOptions = {}

  // Role Credentials
  if (options.awsClientAssumeRole) {
    if (!handler) return
    awsClientConnectionOptions.credentials = handler.context[options.awsClientAssumeRole]
  }

  // Secure Endpoint (FIPS 140-2)
  if (options.awsClientFipsEndpoint) {
    awsClientConnectionOptions.endpoint = `${options.awsClientFipsEndpoint}.${process.ENV.AWS_REGION}.amazonaws.com`
  }

  const awsClientOptions = Object.assign({}, awsClientDefaultOptions, awsClientConnectionOptions, options.awsClientOptions)
  return new options.AwsClient(awsClientOptions)
}

export const canPrefetch = (options) => {
  return (!options?.awsClientAssumeRole && !options?.disablePrefetch)
}

// Internal Context
export const getInternal = async (variables, handler) => {
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
export const sanitizeKey = (key) => {
  return key
    .replace(/[^a-zA-Z0-9]+/g, '_')
}

// fetch Cache
const cache = {} // key: { value, expiry }
export const processCache = (options, fetch = () => undefined, handler) => {
  if (options.cacheExpiry) {
    const cached = cache[options.cacheKey]
    if (cached && (cache.expiry > Date.now() || options.cacheExpiry < 0)) {
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

export const clearCache = (keys = null) => {
  if (!keys) keys = Object.keys(cache)
  for (const cacheKey of keys) {
    delete cache[cacheKey]
  }
}

export const jsonSafeParse = (string, reviver) => {
  try {
    return JSON.parse(string || '{}', reviver)
  } catch (e) {}

  return string
}
