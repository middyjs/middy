import { canPrefetch, createClient, processCache, jsonSafeParse, getInternal } from '../core/util.js'
import { SSM } from '@aws-sdk/client-ssm'

const awsRequestLimit = 10
const defaults = {
  awsClientConstructor: SSM, // Allow for XRay
  awsClientOptions: {
    maxRetries: 6, // lowers a chance to hit service rate limits, default is 3
    retryDelayOptions: { base: 200 }
  },
  awsClientAssumeRole: undefined,
  fetchData: {}, // { contextKey: fetchKey, contextPrefix: fetchPath/ }
  disablePrefetch: false,
  cacheKey: 'ssm',
  cacheExpiry: -1,
  setProcessEnv: false,
  setContext: false,
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = () => {
    const values = {}
    let request = null
    let batch = []
    for (const [idx, contextKey] of Object.keys(options.fetchData).entries()) {
      if (idx % awsRequestLimit === 0) {
        batch = []
        request = null
      }
      batch.push(options.fetchData[contextKey])
      if (!request) {
        request = client
          .getParameters({ Names: batch, WithDecryption: true })
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
      }

      values[contextKey] = request.then(params => {
        params = Object.assign(...params)
        return params[options.fetchData[contextKey]]
      })
    }
    return values
  }

  let prefetch, client, init
  if (canPrefetch(options)) {
    init = true
    client = createClient(options)
    prefetch = processCache(options, fetch)
  }

  const ssmMiddlewareBefore = async (handler) => {
    if (!client) {
      client = createClient(options, handler)
    }
    let cached
    if (init) {
      cached = prefetch
      init = false
    } else {
      cached = processCache(options, fetch, handler)
    }

    Object.assign(handler.internal, cached)
    if (options.setProcessEnv) Object.assign(process.env, await getInternal(Object.keys(options.fetchData), handler))
    if (options.setContext) Object.assign(handler.context, await getInternal(Object.keys(options.fetchData), handler))
  }

  return {
    before: ssmMiddlewareBefore
  }
}
