import { canPrefetch, createClient, processCache } from '../core/util.js'
import { STS } from '@aws-sdk/client-sts'

const defaults = {
  awsClientConstructor: STS, // Allow for XRay
  awsClientOptions: {},
  // awsClientAssumeRole: undefined, // Not Applicable, as this is the middleware that defines the roles
  fetchData: {}, // { contextKey: {RoleArn, RoleSessionName} }
  cacheKey: 'sts',
  cacheExpiry: 0
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = () => {
    const values = {}

    for (const contextKey of options.fetchData) {
      const assumeRoleOptions = options.fetchData[contextKey]
      if (!assumeRoleOptions.RoleSessionName) assumeRoleOptions.RoleSessionName = 'middy-ssm-session-' + Math.random() * 1000 | 0 // Date cannot be used here to assign default session name, possibility of collision when > 1 role defined
      values[contextKey] = client
        .assumeRole(assumeRoleOptions)
        .then(resp => ({
          accessKeyId: resp.Credentials.AccessKeyId,
          secretAccessKey: resp.Credentials.SecretAccessKey,
          sessionToken: resp.Credentials.SessionToken
        }))
    }

    return values
  }

  let prefetch, client
  if (canPrefetch(options)) {
    client = createClient(options)
    prefetch = processCache(options, fetch)
  }

  const stsMiddlewareBefore = async (handler) => {
    if (canPrefetch(options)) {
      await prefetch
    } else if (!client) {
      client = createClient(options, handler)
    }
    const cached = processCache(options, fetch)

    Object.assign(handler.internal, cached)
  }

  return {
    before: stsMiddlewareBefore
  }
}
