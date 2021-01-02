import { canPrefetch, createPrefetchClient, createClient, getInternal, processCache } from '@middy/core/util.js'
import { STS } from '@aws-sdk/client-sts'

const defaults = {
  AwsClient: STS, // Allow for XRay
  awsClientOptions: {},
  // awsClientAssumeRole: undefined, // Not Applicable, as this is the middleware that defines the roles
  fetchData: {}, // { contextKey: {RoleArn, RoleSessionName} }
  disablePrefetch: false,
  cacheKey: 'sts',
  cacheExpiry: -1,
  // setToEnv: false, // returns object, cannot set to process.env
  setToContext: false,
  onChange: undefined
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = () => {
    const values = {}

    for (const internalKey of Object.keys(options.fetchData)) {
      const assumeRoleOptions = options.fetchData[internalKey]
      // Date cannot be used here to assign default session name, possibility of collision when > 1 role defined
      if (!assumeRoleOptions.RoleSessionName) assumeRoleOptions.RoleSessionName = 'middy-sts-session-' + Math.random() * 99999 | 0
      values[internalKey] = client
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
    client = createPrefetchClient(options)
    prefetch = processCache(options, fetch)
  }

  const stsMiddlewareBefore = async (handler) => {
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
    if (options.setToContext) Object.assign(handler.context, await getInternal(Object.keys(options.fetchData), handler))

    if (!init) options?.onChange?.()
    else init = false
  }

  return {
    before: stsMiddlewareBefore
  }
}
