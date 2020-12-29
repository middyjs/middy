import { canPrefetch, createClient, processCache, jsonSafeParse } from '../core/util.js'
import { SSM } from '@aws-sdk/client-ssm'

const defaults = {
  awsClientConstructor: SSM, // Allow for XRay
  awsClientOptions: {
    maxRetries: 6, // lowers a chance to hit service rate limits, default is 3
    retryDelayOptions: { base: 200 }
  },
  awsClientAssumeRole: undefined,
  fetchData: {},  // { contextKey: fetchKey, contextPrefix: fetchPath/ }
  cacheKey: 'secrets-manager',
  cacheExpiry: -1,
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = () => {
    let values = {}

    const request = client
      .getParameters({ Names: Object.values(options.fetchData), WithDecryption: true })
      .then(resp => {
        if (resp.InvalidParameters?.length) {
          throw new Error(
            `InvalidParameters present: ${resp.InvalidParameters.join(', ')}`
          )
        }
        return resp.Parameters.map(param => ({[param.Name]: jsonSafeParse(param.Value)})).flat()  // TODO if type StringList, auto parse?
      })

    for (const contextKey of options.fetchData) {
      values[contextKey] = request.then(params => params[options.fetchData[contextKey]])
    }
    return values
  }

  let prefetch, client
  if (canPrefetch(options)) {
    client = createClient(options)
    prefetch = processCache(options, fetch)
  }

  const ssmMiddlewareBefore = async (handler) => {
    if (canPrefetch(options)) {
      await prefetch
    } else if (!client) {
      client = createClient(options, handler)
    }

    const cached = processCache(options, fetch, handler)

    Object.assign(handler.context, cached)
  }

  return {
    before: ssmMiddlewareBefore
  }
}
