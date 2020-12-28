import { canPreFetch, createClient, processCache } from '../core/util.js'
import { RDS } from '@aws-sdk/client-rds'

const defaults = {
  awsClientConstructor: RDS, // Allow for XRay
  //awsClientOptions: {}, // Not used
  fetchData: {},  // { contextKey: {region, hostname, username, database, port} }
  cacheKey: 'rds-signer',
  cacheExpiry: 0,
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = async () => {
    let values = await Promise.all(Object.keys(options.fetchData).map((contextKey) => {
      return client
        .Signer(options.fetchData[contextKey])
        .getAuthToken()
        .then(resp => {
          return { [contextKey]: resp }
        })
    }))

    return Object.assign({}, ...values)
  }

  let preFetch, client
  if (canPreFetch(options)) {
    client = createClient(options)
    preFetch = processCache(options, fetch)
  }

  const rdsSignerMiddlewareBefore = async (handler) => {
    if (canPreFetch(options)) {
      await preFetch
    } else if (!client) {
      client = createClient(options, handler)
    }

    const cached = await processCache(options, fetch)

    Object.assign(handler.context, cached)
  }

  return {
    before: rdsSignerMiddlewareBefore
  }
}
