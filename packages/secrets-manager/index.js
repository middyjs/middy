import { SecretsManager } from '@aws-sdk/client-secrets-manager'
import { canPrefetch, createPrefetchClient, createClient, processCache, jsonSafeParse, getInternal } from '../core/util.js'

const defaults = {
  AwsClient: SecretsManager, // Allow for XRay
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  fetchData: {}, // If more than 2, consider writing own using ListSecrets
  disablePrefetch: false,
  cacheKey: 'secrets-manager',
  cacheExpiry: -1,
  setToEnv: false, // can return object when requesting db credentials, cannot set to process.env
  setToContext: false,
  onChange: undefined
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = () => {
    const values = {}

    // Multiple secrets can be requested in a single requests,
    // however this is likely uncommon IRL, increases complexity to handle,
    // and will require recursive promise resolution impacting performance.
    // See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SecretsManager.html#listSecrets-property
    for (const contextKey of Object.keys(options.fetchData)) {
      values[contextKey] = client
        .getSecretValue({ SecretId: options.fetchData[contextKey] })
        .then(resp => jsonSafeParse(resp.SecretString))
    }

    return values
  }

  let prefetch, client, init
  if (canPrefetch(options)) {
    init = true
    client = createPrefetchClient(options)
    prefetch = processCache(options, fetch)
  }

  const secretsManagerMiddlewareBefore = async (handler) => {
    if (!client) {
      client = await createClient(options, handler)
    }
    let cached
    if (init) {
      cached = prefetch
    } else {
      cached = processCache(options, fetch, handler)
    }
    if (!init) options?.onChange?.()
    init = false

    Object.assign(handler.internal, cached)
    if (options.setToEnv) Object.assign(process.env, await getInternal(Object.keys(options.fetchData), handler))
    if (options.setToContext) Object.assign(handler.context, await getInternal(Object.keys(options.fetchData), handler))
  }

  return {
    before: secretsManagerMiddlewareBefore
  }
}
