import { canPrefetch, createClient, jsonSafeParse, processCache } from '../core/util.js'
import { RDS } from '@aws-sdk/client-rds'

const defaults = {
  awsClientConstructor: RDS, // Allow for XRay
  //awsClientOptions: {}, // Not used
  fetchData: {},  // { contextKey: {region, hostname, username, database, port} }
  cacheKey: 'rds-signer',
  cacheExpiry: -1,
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = () => {
    let values = {}

    for(const contextKey of options.fetchData) {
      values[contextKey] = client
        .Signer(options.fetchData[contextKey])
        .getAuthToken()
        //.then(resp => resp)
    }

    return values
  }

  let prefetch, client
  if (canPrefetch(options)) {
    client = createClient(options)
    prefetch = processCache(options, fetch)
  }

  const rdsSignerMiddlewareBefore = async (handler) => {
    if (canPrefetch(options)) {
      await prefetch
    } else if (!client) {
      client = createClient(options, handler)
    }

    const cached = await processCache(options, fetch)

    Object.assign(handler.internal, cached)
  }

  return {
    before: rdsSignerMiddlewareBefore
  }
}
