import { canPrefetch, createClient, getInternal, processCache } from '../core/util.js'
import { RDS } from '@aws-sdk/client-rds'

const defaults = {
  AwsClient: RDS.Signer, // Allow for XRay
  awsClientOptions: {},
  fetchData: {}, // { contextKey: {region, hostname, username, database, port} }
  disablePrefetch: false,
  cacheKey: 'rds-signer',
  cacheExpiry: -1,
  setProcessEnv: false,
  setContext: false
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = () => {
    const values = {}

    for (const contextKey of Object.keys(options.fetchData)) {
      values[contextKey] = client
        .Signer({ ...options.awsClientOptions, ...options.fetchData[contextKey] })
        .getAuthToken()
        // .then(resp => resp)
    }

    return values
  }

  let prefetch, client, init
  if (canPrefetch(options)) {
    init = true
    client = createClient(options)
    prefetch = processCache(options, fetch)
  }

  const rdsSignerMiddlewareBefore = async (handler) => {
    if (!client) {
      client = await createClient(options, handler)
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
    before: rdsSignerMiddlewareBefore
  }
}
