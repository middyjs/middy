const {
  canPrefetch,
  createPrefetchClient,
  createClient,
  processCache,
  getCache,
  modifyCache,
  jsonSafeParse,
  getInternal,
  sanitizeKey
} = require('@middy/util')
const SSM = require('aws-sdk/clients/ssm') // v2
// const { SSM } = require('@aws-sdk/client-ssm') // v3

const awsRequestLimit = 10
const defaults = {
  AwsClient: SSM, // Allow for XRay
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {}, // { contextKey: fetchKey, contextPrefix: fetchPath/ }
  disablePrefetch: false,
  cacheKey: 'ssm',
  cacheExpiry: -1,
  setToEnv: false,
  setToContext: false,
  shouldParseValues: true
}

const ssmMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = (request, cachedValues) => {
    return {
      ...fetchSingle(request, cachedValues),
      ...fetchByPath(request, cachedValues)
    }
  }

  const fetchSingle = (request, cachedValues = {}) => {
    const values = {}
    let batchReq = null
    let batchInternalKeys = []
    let batchFetchKeys = []

    const internalKeys = Object.keys(options.fetchData)
    const fetchKeys = Object.values(options.fetchData)
    for (const [idx, internalKey] of internalKeys.entries()) {
      if (cachedValues[internalKey]) continue
      const fetchKey = options.fetchData[internalKey]
      if (fetchKey.substr(-1) === '/') continue // Skip path passed in
      batchInternalKeys.push(internalKey)
      batchFetchKeys.push(fetchKey)
      // from the first to the batch size skip, unless it's the last entry
      if (
        (!idx || (idx + 1) % awsRequestLimit !== 0) &&
        !(idx + 1 === internalKeys.length)
      ) {
        continue
      }

      batchReq = client
        .getParameters({ Names: batchFetchKeys, WithDecryption: true })
        .promise() // Required for aws-sdk v2
        .then((resp) => {
          // Don't sanitize key, mapped to set value in options
          return Object.assign(
            ...(resp.InvalidParameters ?? []).map((fetchKey) => {
              return {
                [fetchKey]: new Promise(() => {
                  const internalKey = internalKeys[fetchKeys.indexOf(fetchKey)]
                  const value = getCache(options.cacheKey)?.value ?? {}
                  value[internalKey] = undefined
                  modifyCache(options.cacheKey, value)
                  throw new Error('ssm.InvalidParameter ' + fetchKey)
                })
              }
            }),
            ...(resp.Parameters ?? []).map((param) => {
              return { [param.Name]: parseValue(param) }
            })
          )
        })
        .catch((e) => {
          const value = getCache(options.cacheKey).value ?? {}
          value[internalKey] = undefined
          modifyCache(options.cacheKey, value)
          throw e
        })

      for (const internalKey of batchInternalKeys) {
        values[internalKey] = batchReq.then((params) => {
          return params[options.fetchData[internalKey]]
        })
      }

      batchInternalKeys = []
      batchFetchKeys = []
      batchReq = null
    }

    return values
  }

  const fetchByPath = (request, cachedValues = {}) => {
    const values = {}
    for (const internalKey in options.fetchData) {
      if (cachedValues[internalKey]) continue
      const fetchKey = options.fetchData[internalKey]
      if (fetchKey.substr(-1) !== '/') continue // Skip not path passed in
      values[internalKey] = fetchPath(fetchKey).catch((e) => {
        const value = getCache(options.cacheKey)?.value ?? {}
        value[internalKey] = undefined
        modifyCache(options.cacheKey, value)
        throw e
      })
    }
    return values
  }

  const fetchPath = (path, nextToken, values = {}) => {
    return client
      .getParametersByPath({
        Path: path,
        NextToken: nextToken,
        Recursive: true,
        WithDecryption: true
      })
      .promise() // Required for aws-sdk v2
      .then((resp) => {
        Object.assign(
          values,
          ...resp.Parameters.map((param) => {
            return {
              [sanitizeKey(param.Name.replace(path, ''))]: parseValue(param)
            }
          })
        )
        if (resp.NextToken) return fetchPath(path, resp.NextToken, values)
        return values
      })
  }

  const parseValue = (param) => {
    if (!options.shouldParseValues) {
      return param.Value
    }
    if (param.Type === 'StringList') {
      return param.Value.split(',')
    }
    return jsonSafeParse(param.Value)
  }

  let prefetch, client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
    prefetch = processCache(options, fetch)
  }

  const ssmMiddlewareBefore = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }

    const { value } = prefetch ?? processCache(options, fetch, request)

    Object.assign(request.internal, value)

    if (options.setToContext || options.setToEnv) {
      const data = await getInternal(Object.keys(options.fetchData), request)
      if (options.setToEnv) Object.assign(process.env, data)
      if (options.setToContext) Object.assign(request.context, data)
    }

    prefetch = null
  }

  return {
    before: ssmMiddlewareBefore
  }
}
module.exports = ssmMiddleware
