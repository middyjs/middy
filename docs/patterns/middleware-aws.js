const {
  canPrefetch,
  createPrefetchClient,
  createClient,
  processCache,
  getCache,
  modifyCache,
  jsonSafeParse,
  getInternal
} = require('@middy/util')
const AWSService = require('aws-sdk/clients/aws-service') // v2
// const { AWSService } = require('@aws-sdk/client-aws-service')  // v3

const defaults = {
  AwsClient: AWSService,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {},
  disablePrefetch: false,
  cacheKey: 'aws-service',
  cacheExpiry: -1,
  setToContext: false
}

const awsServiceMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = (request, cachedValues = {}) => {
    const values = {}

    for (const internalKey of Object.keys(options.fetchData)) {
      if (cachedValues[internalKey]) continue
      values[internalKey] = client
        .getValue({ Id: options.fetchData[internalKey] }) // <--
        .promise() // Required for aws-sdk v2
        .then((resp) => jsonSafeParse(resp.ValueString)) // <--
        .catch((e) => {
          const value = getCache(options.cacheKey)?.value ?? {}
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

  const awsServiceMiddlewareBefore = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }

    const { value } = prefetch ?? processCache(options, fetch, request)

    Object.assign(request.internal, value)

    if (options.setToContext) {
      const data = await getInternal(Object.keys(options.fetchData), request)
      Object.assign(request.context, data)
    }

    prefetch = null
  }

  return {
    before: awsServiceMiddlewareBefore
  }
}

module.exports = awsServiceMiddleware
