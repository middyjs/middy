const { canPrefetch, createClient, getInternal, processCache } = require('@middy/core/util.js')
const RDS = require('aws-sdk/clients/rds.js') // v2
// const { RDS } = require('@aws-sdk/client-rds') // v3

const defaults = {
  AwsClient: RDS.Signer,
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

  const fetch = (handler) => () => {
    const values = {}
    for (const internalKey of Object.keys(options.fetchData)) {
      const awsClientOptions = {
        AwsClient: options.AwsClient,
        awsClientOptions: { ...options.awsClientOptions, ...options.fetchData[internalKey] },
        awsClientAssumeRole: options.awsClientAssumeRole,
        awsClientCapture: options.awsClientCapture
      }

      // AWS doesn't support getAuthToken.promise() in aws-sdk v2 :( See https://github.com/aws/aws-sdk-js/issues/3595
      values[internalKey] = new Promise((resolve, reject) => {
        createClient(awsClientOptions, handler).then(client => {
          client.getAuthToken({}, (err, token) => {
            if (err) {
              reject(err)
            }
            resolve(token)
          })
        })
      })
      // aws-sdk v3
      // values[internalKey] = createClient(awsClientOptions, handler).then(client => client.getAuthToken())
    }

    return values
  }

  let prefetch, init
  if (canPrefetch(options)) {
    init = true
    prefetch = processCache(options, fetch())
  }

  const rdsSignerMiddlewareBefore = async (handler) => {
    let cached
    if (init) {
      cached = prefetch
    } else {
      cached = processCache(options, fetch(handler), handler)
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
