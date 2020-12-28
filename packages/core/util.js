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

export const canPreFetch = (options) => {
  return (!options.awsClientAssumeRole)
}

// Context
export const getContext = (handler, mappings, options) => {
  for(const key in mappings) {
    options[key] = handler.context[mappings[key]]
  }
}

export const setContext = (handler, mappings) => {
  Object.assign(handler.context, mappings)
}

// Option Cache
const cache = {}  // key: { value, expiry }
export const processCache = async (options, fetch = () => undefined) => {
  if (options.cacheExpiry) {
    const cached = cache[options.cacheKey]
    if (cached?.expiry > Date.now() || options.cacheExpiry < 0) {
      return cached.value
    }
  }
  const value = await fetch()
  if (options.cacheExpiry) {
    cache[options.cacheKey] = {
      value,
      expiry: Date.now() + options.cacheExpiry
    }
  }
  return value
}

export const safeParseJSON = (string, reviver) => {
  try {
    return JSON.parse(string || '{}', reviver)
  } catch (err) {
  }

  return string
}
