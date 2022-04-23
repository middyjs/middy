import {
  canPrefetch,
  createPrefetchClient,
  createClient,
  getCache,
  getInternal,
  processCache,
  modifyCache
} from '@middy/util'
import STS from 'aws-sdk/clients/sts.js' // v2
// import { STS } from '@aws-sdk/client-sts' // v3

const defaults = {
  AwsClient: STS,
  awsClientOptions: {},
  // awsClientAssumeRole: undefined, // Not Applicable, as this is the middleware that defines the roles
  awsClientCapture: undefined,
  fetchData: {}, // { contextKey: {RoleArn, RoleSessionName} }
  disablePrefetch: false,
  cacheKey: 'sts',
  cacheExpiry: -1,
  setToContext: false
}

const stsMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = (request, cachedValues = {}) => {
    const values = {}

    for (const internalKey of Object.keys(options.fetchData)) {
      if (cachedValues[internalKey]) continue
      const assumeRoleOptions = options.fetchData[internalKey]
      // Date cannot be used here to assign default session name, possibility of collision when > 1 role defined
      assumeRoleOptions.RoleSessionName ??=
        'middy-sts-session-' + Math.ceil(Math.random() * 99999)
      values[internalKey] = client
        .assumeRole(assumeRoleOptions)
        .promise() // Required for aws-sdk v2
        .then((resp) => ({
          accessKeyId: resp.Credentials.AccessKeyId,
          secretAccessKey: resp.Credentials.SecretAccessKey,
          sessionToken: resp.Credentials.SessionToken
        }))
        .catch((e) => {
          const value = getCache(options.cacheKey).value ?? {}
          value[internalKey] = undefined
          modifyCache(options.cacheKey, value)
          throw e
        })
    }

    return values
  }

  let prefetch, client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
    prefetch = processCache(options, fetch)
  }

  const stsMiddlewareBefore = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }

    const { value } = prefetch ?? processCache(options, fetch, request)

    Object.assign(request.internal, value)

    if (options.setToContext) {
      const data = await getInternal(Object.keys(options.fetchData), request)
      if (options.setToContext) Object.assign(request.context, data)
    }
    prefetch = null
  }

  return {
    before: stsMiddlewareBefore
  }
}
export default stsMiddleware
