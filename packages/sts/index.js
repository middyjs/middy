import { canPreFetch, createClient, processCache } from '../core/util.js'
import {STS} from '@aws-sdk/client-sts'

const defaults = {
  awsClientConstructor: STS, // Allow for XRay
  awsClientOptions: {},
  //awsClientAssumeRole: undefined, // Not Applicable, as this is the middleware that defines the roles
  fetchData: {},  // { contextKey: {RoleArn, RoleSessionName} }
  cacheKey: 'sts',
  cacheExpiry: 0,
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = async () => {
    let values = await Promise.all(Object.keys(options.fetchData).map((contextKey) => {
      const assumeRoleOptions = options.fetchData[contextKey]
      if (!assumeRoleOptions.RoleSessionName) assumeRoleOptions.RoleSessionName = 'middy-ssm-session-' + Math.random()*1000|0 // Date cannot be used here to assign default session name, possibility of collision when > 1 role defined
      return client
        .assumeRole(assumeRoleOptions)
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

  const stsMiddlewareBefore = async (handler) => {
    if (canPreFetch(options)) {
      await preFetch
    } else if (!client) {
      client = createClient(options, handler)
    }
    const cached = await processCache(options, fetch)

    Object.assign(handler.context, cached)
  }

  return {
    before:stsMiddlewareBefore
  }
}
