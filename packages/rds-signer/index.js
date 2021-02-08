const {
  canPrefetch,
  createClient,
  getInternal,
  processCache
} = require('@middy/util')
const RDS = require('aws-sdk/clients/rds.js') // v2
// const { RDS } = require('@aws-sdk/client-rds') // v3

const defaults = {
  AwsClient: RDS.Signer,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {}, // { contextKey: {region, hostname, username, database, port} }
  disablePrefetch: false,
  cacheKey: 'rds-signer',
  cacheExpiry: -1,
  setToEnv: false,
  setToContext: false,
  onChange: undefined
}

const rdsSignerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = (handler) => {
    const values = {}
    for (const internalKey of Object.keys(options.fetchData)) {
      const awsClientOptions = {
        AwsClient: options.AwsClient,
        awsClientOptions: {
          ...options.awsClientOptions,
          ...options.fetchData[internalKey]
        },
        awsClientAssumeRole: options.awsClientAssumeRole,
        awsClientCapture: options.awsClientCapture
      }

      // AWS doesn't support getAuthToken.promise() in aws-sdk v2 :( See https://github.com/aws/aws-sdk-js/issues/3595
      values[internalKey] = new Promise((resolve, reject) => {
        createClient(awsClientOptions, handler).then((client) => {
          client.getAuthToken({}, (err, token) => {
            if (err) {
              return reject(err)
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

  let prefetch
  if (canPrefetch(options)) {
    prefetch = processCache(options, fetch)
  }

  const rdsSignerMiddlewareBefore = async (handler) => {
    const { value } = prefetch ?? processCache(options, fetch, handler)

    Object.assign(handler.internal, value)

    if (options.setToContext || options.setToEnv) {
      const data = await getInternal(Object.keys(options.fetchData), handler)
      if (options.setToEnv) Object.assign(process.env, data)
      if (options.setToContext) Object.assign(handler.context, data)
    }

    prefetch = null
  }

  return {
    before: rdsSignerMiddlewareBefore
  }
}
module.exports = rdsSignerMiddleware
