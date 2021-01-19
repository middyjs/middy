const { canPrefetch, createPrefetchClient, createClient, processCache, jsonSafeParse, getInternal } = require('@middy/util')
const SecretsManager = require('aws-sdk/clients/secretsmanager.js') // v2
// const { SecretsManager } = require('@aws-sdk/client-secrets-manager')  // v3

const defaults = {
  AwsClient: SecretsManager,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {}, // If more than 2, consider writing own using ListSecrets
  disablePrefetch: false,
  cacheKey: 'secrets-manager',
  cacheExpiry: -1,
  setToEnv: false, // can return object when requesting db credentials, cannot set to process.env
  setToContext: false,
  onChange: undefined
}

module.exports = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = () => {
    const values = {}

    // Multiple secrets can be requested in a single requests,
    // however this is likely uncommon IRL, increases complexity to handle,
    // and will require recursive promise resolution impacting performance.
    // See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SecretsManager.html#listSecrets-property
    for (const internalKey of Object.keys(options.fetchData)) {
      values[internalKey] = client
        .getSecretValue({ SecretId: options.fetchData[internalKey] })
        .promise() // Required for aws-sdk v2
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

    Object.assign(handler.internal, cached)
    if (options.setToEnv) Object.assign(process.env, await getInternal(Object.keys(options.fetchData), handler))
    if (options.setToContext) Object.assign(handler.context, await getInternal(Object.keys(options.fetchData), handler))

    if (!init) options?.onChange?.()
    else init = false
  }

  return {
    before: secretsManagerMiddlewareBefore
  }
}
