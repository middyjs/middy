import {
  canPrefetch,
  createPrefetchClient,
  createClient,
  processCache,
  getCache,
  modifyCache,
  jsonSafeParse,
  getInternal,
  sanitizeKey,
  catchInvalidSignatureException
} from '../util/index.js'
import {
  SSMClient,
  GetParametersCommand,
  GetParametersByPathCommand
} from '@aws-sdk/client-ssm'

const awsRequestLimit = 10
const defaults = {
  AwsClient: SSMClient, // Allow for XRay
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {}, // { contextKey: fetchKey, contextPrefix: fetchPath/ }
  disablePrefetch: false,
  cacheKey: 'ssm',
  cacheKeyExpiry: {},
  cacheExpiry: -1,
  setToContext: false
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
    const namedKeys = []

    const internalKeys = Object.keys(options.fetchData)
    const fetchKeys = Object.values(options.fetchData)
    for (const internalKey of internalKeys) {
      if (cachedValues[internalKey]) continue
      if (options.fetchData[internalKey].substr(-1) === '/') continue // Skip path passed in
      namedKeys.push(internalKey)
    }

    for (const [idx, internalKey] of namedKeys.entries()) {
      const fetchKey = options.fetchData[internalKey]
      batchInternalKeys.push(internalKey)
      batchFetchKeys.push(fetchKey)
      // from the first to the batch size skip, unless it's the last entry
      if (
        (!idx || (idx + 1) % awsRequestLimit !== 0) &&
        !(idx + 1 === namedKeys.length)
      ) {
        continue
      }

      const command = new GetParametersCommand({
        Names: batchFetchKeys,
        WithDecryption: true
      })
      batchReq = client
        .send(command)
        .catch((e) => catchInvalidSignatureException(e, client, command))
        .then((resp) => {
          // Don't sanitize key, mapped to set value in options
          return Object.assign(
            ...(resp.InvalidParameters ?? []).map((fetchKey) => {
              return {
                [fetchKey]: new Promise(() => {
                  const internalKey = internalKeys[fetchKeys.indexOf(fetchKey)]
                  const value = getCache(options.cacheKey).value ?? {}
                  value[internalKey] = undefined
                  modifyCache(options.cacheKey, value)
                  throw new Error('InvalidParameter ' + fetchKey, {
                    cause: { package: '@middy/ssm' }
                  })
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
        const value = getCache(options.cacheKey).value ?? {}
        value[internalKey] = undefined
        modifyCache(options.cacheKey, value)
        throw e
      })
    }
    return values
  }

  const fetchPath = (path, nextToken, values = {}) => {
    const command = new GetParametersByPathCommand({
      Path: path,
      NextToken: nextToken,
      Recursive: true,
      WithDecryption: true
    })
    return client
      .send(command)
      .catch((e) => catchInvalidSignatureException(e, client, command))
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
    if (param.Type === 'StringList') {
      return param.Value.split(',')
    }
    return jsonSafeParse(param.Value)
  }

  let client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
    processCache(options, fetch)
  }

  const ssmMiddlewareBefore = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }

    const { value } = processCache(options, fetch, request)

    Object.assign(request.internal, value)

    if (options.setToContext) {
      const data = await getInternal(Object.keys(options.fetchData), request)
      Object.assign(request.context, data)
    }
  }

  return {
    before: ssmMiddlewareBefore
  }
}

export default ssmMiddleware

// used for TS type inference (see index.d.ts)
export function ssmParam (name) {
  return name
}
