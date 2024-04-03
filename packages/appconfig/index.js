import {
  canPrefetch,
  createPrefetchClient,
  createClient,
  getCache,
  getInternal,
  processCache,
  modifyCache,
  jsonSafeParse,
  catchInvalidSignatureException
} from '@middy/util'
import {
  AppConfigClient,
  GetConfigurationCommand
} from '@aws-sdk/client-appconfig'
const defaults = {
  AwsClient: AppConfigClient,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {},
  disablePrefetch: false,
  cacheKey: 'appconfig',
  cacheKeyExpiry: {},
  cacheExpiry: -1,
  setToContext: false
}
const contentTypePattern = /^application\/(.+\+)?json($|;.+)/
const appConfigMiddleware = (opts = {}) => {
  const options = {
    ...defaults,
    ...opts
  }
  const fetch = (request, cachedValues = {}) => {
    const values = {}
    for (const internalKey of Object.keys(options.fetchData)) {
      if (cachedValues[internalKey]) continue
      const command = new GetConfigurationCommand(
        options.fetchData[internalKey]
      )
      values[internalKey] = client
        .send(command)
        .catch((e) => catchInvalidSignatureException(e, client, command))
        .then((resp) => {
          let value = String.fromCharCode.apply(null, resp.Content)
          if (contentTypePattern.test(resp.ContentType)) {
            value = jsonSafeParse(value)
          }
          return value
        })
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
  const appConfigMiddlewareBefore = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }
    const { value } = processCache(options, fetch, request)
    Object.assign(request.internal, value)
    if (options.setToContext) {
      const data = await getInternal(Object.keys(options.fetchData), request)
      Object.assign(request.context, data)
    }
  }
  return {
    before: appConfigMiddlewareBefore
  }
}
export default appConfigMiddleware

// # sourceMappingURL=index.js.map
