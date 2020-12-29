import https from 'https'
import {NodeHttpHandler} from '@aws-sdk/node-http-handler'

// Docs: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/enforcing-tls.html
export const awsClientDefaultOptions = {
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent(
      {
        secureProtocol: 'TLSv1_2_method'
      }
    )
  })
}

export const createClient = (options, handler) => {
  let awsClientCredentials = {}
  if (options.awsClientAssumeRole) {
    if (!handler) return
    awsClientCredentials = {credentials: handler.context[options.awsClientAssumeRole]}
  }
  Object.assign(options.awsClientOptions, awsClientDefaultOptions, awsClientCredentials)
  return new options.awsClientConstructor(options.awsClientOptions)
}

export const canPrefetch = (options) => {
  return (!options.awsClientAssumeRole || !options.disablePrefetch)
}

// Context
export const getInternal = async (mapping = {}, handler) => {
  const values = {}
  for(const optionKey in mapping) {
    // ensure promise has resolved by the time it's needed
    const value = await handler.context[mapping[optionKey]]
    handler.context[mapping[optionKey]] = value
    values[optionKey] = value
  }
  return values
}

// Option Cache
const cache = {}  // key: { value, expiry }
export const processCache = (options, fetch = () => undefined, handler) => {
  if (options.cacheExpiry) {
    const cached = cache[options.cacheKey]
    if (cached?.expiry > Date.now() || options.cacheExpiry < 0) {
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

export const jsonSafeParse = (string, reviver) => {
  try {
    return JSON.parse(string || '{}', reviver)
  } catch (err) {
  }

  return string
}
