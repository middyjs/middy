const {
  canPrefetch,
  createPrefetchClient,
  createClient,
  processCache,
  jsonSafeParse,
  getInternal,
  sanitizeKey
} = require('@middy/util')
const SSM = require('aws-sdk/clients/ssm.js') // v2
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
  onChange: undefined
}

module.exports = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = () => {
    return { ...fetchSingle(), ...fetchByPath() }
  }

  const fetchSingle = () => {
    const values = {}
    let request = null
    let batch = []

    const internalKeys = Object.keys(options.fetchData)
    const fetchKeys = Object.values(options.fetchData)
    for (const [idx, fetchKey] of fetchKeys.entries()) {
      if (fetchKey.substr(-1) === '/') continue // Skip path passed in
      batch.push(fetchKey)
      // from the first to the batch size skip, unless it's the last entry
      if (
        (!idx || (idx + 1) % awsRequestLimit !== 0) &&
        !(idx + 1 === internalKeys.length)
      ) {
        continue
      }

      request = client
        .getParameters({ Names: batch, WithDecryption: true })
        .promise() // Required for aws-sdk v2
        .then((resp) => {
          if (resp.InvalidParameters?.length) {
            throw new Error(
              `InvalidParameters present: ${resp.InvalidParameters.join(', ')}`
            )
          }
          return Object.assign(
            ...resp.Parameters.map((param) => {
              // Don't sanitize key, mapped to set value in options
              return { [param.Name]: parseValue(param) }
            })
          )
        })

      for (const fetchKey of batch) {
        const internalKey = internalKeys[fetchKeys.indexOf(fetchKey)]
        values[internalKey] = request.then((params) => params[fetchKey])
      }

      batch = []
      request = null
    }

    return values
  }

  const fetchByPath = () => {
    const values = {}
    for (const internalKey in options.fetchData) {
      const fetchKey = options.fetchData[internalKey]
      if (fetchKey.substr(-1) !== '/') continue // Skip not path passed in
      values[internalKey] = fetchPath(fetchKey)
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
        if (resp.NextToken) return fetchPath(path, resp.nextToken, values)
        return values
      })
  }

  const parseValue = (param) => {
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

  const ssmMiddlewareBefore = async (handler) => {
    if (!client) {
      client = await createClient(options, handler)
    }

    const { value } = prefetch ?? processCache(options, fetch, handler)

    Object.assign(handler.internal, value)

    if (options.setToContext || options.setToEnv) {
      const data = await getInternal(Object.keys(options.fetchData), handler)
      if (options.setToEnv) Object.assign(process.env, data)
      if (options.setToContext) Object.assign(handler.context, data)
    }

    prefetch = null
  }

  return {
    before: ssmMiddlewareBefore
  }
}
