import {
  canPrefetch,
  createPrefetchClient,
  createClient,
  processCache,
  getCache,
  modifyCache,
  jsonSafeParse,
  getInternal
} from '@middy/util'
import SecretsManager from 'aws-sdk/clients/secretsmanager.js' // v2
// import { SecretsManager } from '@aws-sdk/client-secrets-manager'  // v3

const defaults = {
  AwsClient: SecretsManager,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {}, // If more than 2, consider writing own using ListSecrets
  disablePrefetch: false,
  cacheKey: 'secrets-manager',
  cacheExpiry: -1,
  setToContext: false
}

const secretsManagerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = (request, cachedValues = {}) => {
    const values = {}

    // Multiple secrets can be requested in a single requests,
    // however this is likely uncommon IRL, increases complexity to handle,
    // and will require recursive promise resolution impacting performance.
    // See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SecretsManager.html#listSecrets-property
    for (const internalKey of Object.keys(options.fetchData)) {
      if (cachedValues[internalKey]) continue
      values[internalKey] = client
        .getSecretValue({ SecretId: options.fetchData[internalKey] })
        .promise() // Required for aws-sdk v2
        .then((resp) => jsonSafeParse(resp.SecretString))
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

  const secretsManagerMiddlewareBefore = async (request) => {
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
    before: secretsManagerMiddlewareBefore
  }
}
export default secretsManagerMiddleware
