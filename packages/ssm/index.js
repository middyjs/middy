import {
  canPrefetch,
  createPrefetchClient,
  createClient,
  processCache,
  jsonSafeParse,
  getInternal
} from '@middy/core/util.js'
import SSM from 'aws-sdk/clients/ssm.js' // v2
// import { SSM } from '@aws-sdk/client-ssm' // v3

const awsRequestLimit = 10
const defaults = {
  AwsClient: SSM, // Allow for XRay
  awsClientOptions: {
    maxRetries: 6, // lowers a chance to hit service rate limits, default is 3
    retryDelayOptions: { base: 200 }
  },
  awsClientAssumeRole: undefined,
  fetchData: {}, // { contextKey: fetchKey, contextPrefix: fetchPath/ }
  disablePrefetch: false,
  cacheKey: 'ssm',
  cacheExpiry: -1,
  setToEnv: false,
  setToContext: false,
  onChange: undefined
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = () => {
    const values = {}
    let request = null
    let batch = []

    const internalKeys = Object.keys(options.fetchData)
    const fetchKeys = Object.values(options.fetchData)
    for (const [idx, fetchKey] of fetchKeys.entries()) {
      batch.push(fetchKey)
      // from the first to the batch size skip, unless it's the last entry
      if ((!idx || (idx + 1) % awsRequestLimit !== 0) && !(idx + 1 === internalKeys.length)) {
        continue
      }

      request = client
        .getParameters({ Names: batch, WithDecryption: true })
        .promise() // Required for aws-sdk v2
        .then(resp => {
          if (resp.InvalidParameters?.length) {
            throw new Error(
              `InvalidParameters present: ${resp.InvalidParameters.join(', ')}`
            )
          }
          return resp.Parameters
            .map(param => {
              return { [param.Name]: jsonSafeParse(param.Value) }
            })
        })

      for (const fetchKey of batch) {
        const internalKey = internalKeys[fetchKeys.indexOf(fetchKey)]
        values[internalKey] = request.then(params => {
          params = Object.assign(...params)
          return params[fetchKey]
        })
      }

      batch = []
      request = null
    }

    return values
  }

  let prefetch, client, init
  if (canPrefetch(options)) {
    init = true
    client = createPrefetchClient(options)
    prefetch = processCache(options, fetch)
  }

  const ssmMiddlewareBefore = async (handler) => {
    if (!client) {
      client = await createClient(options, handler)
    }
    let cached
    if (init) {
      cached = prefetch
    } else {
      cached = processCache(options, fetch, handler)
    }

    Object.assign(handler.internal, cached)
    if (options.setToEnv) Object.assign(process.env, await getInternal(Object.keys(options.fetchData), handler))
    if (options.setToContext) Object.assign(handler.context, await getInternal(Object.keys(options.fetchData), handler))

    if (!init) options?.onChange?.()
    else init = false
  }

  return {
    before: ssmMiddlewareBefore
  }
}
