import {
  canPrefetch,
  createPrefetchClient,
  createClient,
  getCache,
  getInternal,
  processCache,
  modifyCache,
  catchInvalidSignatureException
} from '@middy/util'
import {
  ServiceDiscoveryClient,
  DiscoverInstancesCommand
} from '@aws-sdk/client-servicediscovery'

const defaults = {
  AwsClient: ServiceDiscoveryClient,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {}, // { contextKey: {NamespaceName, ServiceName, HealthStatus} }
  disablePrefetch: false,
  cacheKey: 'cloud-map',
  cacheKeyExpiry: {},
  cacheExpiry: -1,
  setToContext: false
}

const serviceDiscoveryMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = (request, cachedValues = {}) => {
    const values = {}

    for (const internalKey of Object.keys(options.fetchData)) {
      if (cachedValues[internalKey]) continue
      const command = new DiscoverInstancesCommand(
        options.fetchData[internalKey]
      )

      values[internalKey] = client
        .send(command)
        .catch((e) => catchInvalidSignatureException(e, client, command))
        .then((resp) => resp.Instances)
        .catch((e) => {
          const value = getCache(options.cacheKey).value ?? {}
          value[internalKey] = undefined
          modifyCache(options.cacheKey, value)
          throw e
        })
    }

    return values
  }

  let client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
    processCache(options, fetch)
  }

  const serviceDiscoveryMiddlewareBefore = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }

    const { value } = processCache(options, fetch, request)

    Object.assign(request.internal, value)

    if (options.setToContext) {
      const data = await getInternal(Object.keys(options.fetchData), request)
      if (options.setToContext) Object.assign(request.context, data)
    }
  }

  return {
    before: serviceDiscoveryMiddlewareBefore
  }
}
export default serviceDiscoveryMiddleware
