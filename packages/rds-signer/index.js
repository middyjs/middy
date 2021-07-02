const {
  canPrefetch,
  getInternal,
  processCache,
  getCache,
  modifyCache
} = require('@middy/util')
const RDS = require('aws-sdk/clients/rds') // v2
// const { RDS } = require('@aws-sdk/client-rds') // v3

const defaults = {
  AwsClient: RDS.Signer,
  awsClientOptions: {},
  fetchData: {}, // { contextKey: {region, hostname, username, database, port} }
  disablePrefetch: false,
  cacheKey: 'rds-signer',
  cacheExpiry: -1,
  setToEnv: false,
  setToContext: false
}

const rdsSignerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = (request, cachedValues = {}) => {
    const values = {}
    for (const internalKey of Object.keys(options.fetchData)) {
      if (cachedValues[internalKey]) continue

      const client = new options.AwsClient({
        ...options.awsClientOptions,
        ...options.fetchData[internalKey]
      })
      // AWS doesn't support getAuthToken.promise() in aws-sdk v2 :( See https://github.com/aws/aws-sdk-js/issues/3595
      values[internalKey] = new Promise((resolve, reject) => {
        client.getAuthToken({}, (err, token) => {
          if (err) {
            reject(err)
          }
          // Catch Missing token, this usually means their is something wrong with the credentials
          if (!token.includes('X-Amz-Security-Token=')) {
            reject(new Error('X-Amz-Security-Token Missing'))
          }
          resolve(token)
        })
      }).catch((e) => {
        const value = getCache(options.cacheKey)?.value ?? {}
        value[internalKey] = undefined
        modifyCache(options.cacheKey, value)
        throw e
      })
      // aws-sdk v3
      // values[internalKey] = createClient(awsClientOptions, request).then(client => client.getAuthToken())
    }

    return values
  }

  let prefetch
  if (canPrefetch(options)) {
    prefetch = processCache(options, fetch)
  }

  const rdsSignerMiddlewareBefore = async (request) => {
    const { value } = prefetch ?? processCache(options, fetch, request)

    Object.assign(request.internal, value)

    if (options.setToContext || options.setToEnv) {
      const data = await getInternal(Object.keys(options.fetchData), request)
      if (options.setToEnv) Object.assign(process.env, data)
      if (options.setToContext) Object.assign(request.context, data)
    }

    prefetch = null
  }

  return {
    before: rdsSignerMiddlewareBefore
  }
}
module.exports = rdsSignerMiddleware
