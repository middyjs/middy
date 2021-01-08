const { canPrefetch, createClient, getInternal, processCache } = require('@middy/core/util.js')
const RDS = require('aws-sdk/clients/rds.js') // v2
// const { RDS } = require('@aws-sdk/client-rds') // v3

const defaults = {
  AwsClient: RDS,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: false,
  fetchData: {}, // { contextKey: {region, hostname, username, database, port} }
  disablePrefetch: false,
  cacheKey: 'rds-signer',
  cacheExpiry: -1,
  setToEnv: false,
  setToContext: false,
  onChange: undefined
}

module.exports = (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = () => {
    const values = {}

    for (const internalKey of Object.keys(options.fetchData)) {
      values[internalKey] = client
        .Signer({ ...options.awsClientOptions, ...options.fetchData[internalKey] })
        .getAuthToken()
        .promise() // Required for aws-sdk v2
        // .then(resp => resp)
    }

    return values
  }

  let prefetch, client, init
  if (canPrefetch(options)) {
    init = true
    // client = createClient(options)
    prefetch = processCache(options, fetch)
  }

  const rdsSignerMiddlewareBefore = async (handler) => {
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
    if (options.setToEnv) Object.assign(process.env, await getInternal(Object.keys(options.fetchData), handler))
    if (options.setToContext) Object.assign(handler.context, await getInternal(Object.keys(options.fetchData), handler))

    if (!init) options?.onChange?.()
    else init = false
  }

  return {
    before: rdsSignerMiddlewareBefore
  }
}
