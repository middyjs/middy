import { canPrefetch, createClient, getInternal, processCache } from '../core/util.js'
import { STS } from '@aws-sdk/client-sts'

const defaults = {
  awsClientConstructor: STS, // Allow for XRay
  awsClientOptions: {},
  // awsClientAssumeRole: undefined, // Not Applicable, as this is the middleware that defines the roles
  fetchData: {}, // { contextKey: {RoleArn, RoleSessionName} }
  disablePrefetch: false,
  cacheKey: 'sts',
  cacheExpiry: -1,
  //setProcessEnv: false, // returns object, cannot set to process.env
  setContext: false,
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = () => {
    const values = {}

    for (const contextKey of Object.keys(options.fetchData)) {
      const assumeRoleOptions = options.fetchData[contextKey]
      // Date cannot be used here to assign default session name, possibility of collision when > 1 role defined
      if (!assumeRoleOptions.RoleSessionName) assumeRoleOptions.RoleSessionName = 'middy-ssm-session-' + Math.random() * 99999 | 0
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

  let prefetch, client, init
  if (canPrefetch(options)) {
    init = true
    client = createClient(options)
    prefetch = processCache(options, fetch)
  }

  const stsMiddlewareBefore = async (handler) => {
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
    if (options.setContext) Object.assign(handler.context, await getInternal(Object.keys(options.fetchData), handler))
  }

  return {
    before: stsMiddlewareBefore
  }
}
