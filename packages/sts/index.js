import { canPreFetch, createClient, processCache } from '../core/util.js'
import {STS} from '@aws-sdk/client-sts'

export default (opts = {}) => {
  const defaults = {
    awsClientConstructor: STS, // Allow for XRay
    awsClientOptions: {},
    //awsClientAssumeRole: undefined, // NA
    fetchKeys: {},  // { contextKey: {RoleArn, RoleSessionName} }
    cacheKey: 'sts',
    cacheExpiry: 0,
  }

  const options = Object.assign({}, defaults, opts)

  const fetch = async () => {
    let values = await Promise.all(Object.keys(options.fetchKeys).map((contextKey) => {
      return client
        .assumeRole(options.fetchKeys[contextKey])
        .then(resp => {
          return {[contextKey]: {
              accessKeyId: resp.Credentials.AccessKeyId,
              secretAccessKey: resp.Credentials.SecretAccessKey,
              sessionToken: resp.Credentials.SessionToken
            }}
        })
    }))

    return Object.assign({}, ...values)
  }

  let preFetch, client
  if (canPreFetch(options)) {
    client = createClient(options)
    preFetch = processCache(options, fetch)
  }

  const before = async (handler) => {
    if (canPreFetch(options)) {
      await preFetch
    } else if (!client) {
      client = createClient(options, handler)
    }
    const cached = await processCache(options, fetch)

    Object.assign(handler.context, cached)
  }

  return { before }
}
