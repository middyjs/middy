import {
  canPrefetch,
  createPrefetchClient,
  createClient,
  getCache,
  getInternal,
  processCache,
  modifyCache
} from '@middy/util'
import ServiceDiscovery from 'aws-sdk/clients/servicediscovery.js' // v2
// import { ServiceDiscovery } from '@aws-sdk/client-servicediscovery' // v3

const defaults = {
  AwsClient: ServiceDiscovery,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {}, // { contextKey: {NamespaceName, ServiceName, HealthStatus} }
  disablePrefetch: false,
  cacheKey: 'cloud-map',
  cacheExpiry: -1,
  setToContext: false
}

const serviceDiscoveryMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = (request, cachedValues = {}) => {
    const values = {}

    for (const internalKey of Object.keys(options.fetchData)) {
      if (cachedValues[internalKey]) continue

      values[internalKey] = client
        .discoverInstances(options.fetchData[internalKey])
        .promise() // Required for aws-sdk v2
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

  let prefetch, client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
    prefetch = processCache(options, fetch)
  }

  const serviceDiscoveryMiddlewareBefore = async (request) => {
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
    before: serviceDiscoveryMiddlewareBefore
  }
}
export default serviceDiscoveryMiddleware
