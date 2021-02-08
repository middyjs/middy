const {
  canPrefetch,
  createPrefetchClient,
  createClient,
  getInternal,
  processCache
} = require('@middy/util')
const STS = require('aws-sdk/clients/sts.js') // v2
// const { STS } = require('@aws-sdk/client-sts') // v3

const defaults = {
  AwsClient: STS,
  awsClientOptions: {},
  // awsClientAssumeRole: undefined, // Not Applicable, as this is the middleware that defines the roles
  awsClientCapture: undefined,
  fetchData: {}, // { contextKey: {RoleArn, RoleSessionName} }
  disablePrefetch: false,
  cacheKey: 'sts',
  cacheExpiry: -1,
  // setToEnv: false, // returns object, cannot set to process.env
  setToContext: false,
  onChange: undefined
}

module.exports = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = () => {
    const values = {}

    for (const internalKey of Object.keys(options.fetchData)) {
      const assumeRoleOptions = options.fetchData[internalKey]
      // Date cannot be used here to assign default session name, possibility of collision when > 1 role defined
      assumeRoleOptions.RoleSessionName =
        assumeRoleOptions?.RoleSessionName ??
        'middy-sts-session-' + Math.ceil(Math.random() * 99999)
      values[internalKey] = client
        .assumeRole(assumeRoleOptions)
        .promise() // Required for aws-sdk v2
        .then((resp) => ({
          accessKeyId: resp.Credentials.AccessKeyId,
          secretAccessKey: resp.Credentials.SecretAccessKey,
          sessionToken: resp.Credentials.SessionToken
        }))
    }

    return values
  }

  let prefetch, client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
    prefetch = processCache(options, fetch)
  }

  const stsMiddlewareBefore = async (handler) => {
    if (!client) {
      client = await createClient(options, handler)
    }

    const { value } = prefetch ?? processCache(options, fetch, handler)

    Object.assign(handler.internal, value)

    if (options.setToContext) {
      const data = await getInternal(Object.keys(options.fetchData), handler)
      if (options.setToContext) Object.assign(handler.context, data)
    }
    prefetch = null
  }

  return {
    before: stsMiddlewareBefore
  }
}
