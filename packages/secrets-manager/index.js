import { canPreFetch, createClient, processCache, safeParseJSON } from '../core/util.js'
import { SecretsManager } from '@aws-sdk/client-secrets-manager'

const defaults = {
  awsClientConstructor: SecretsManager, // Allow for XRay
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  fetchData: {},
  cacheKey: 'secrets-manager',
  cacheExpiry: 0,
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = async () => {
    let values = await Promise.all(Object.keys(options.fetchData).map((contextKey) => {
      return client
        .getSecretValue({ SecretId: options.fetchData[contextKey] })
        .then(resp => {
          return { [contextKey]: safeParseJSON(resp) }
        })
    }))

    return Object.assign({}, ...values)
  }

  let preFetch, client
  if (canPreFetch(options)) {
    client = createClient(options)
    preFetch = processCache(options, fetch)
  }

  const secretsManagerMiddlewareBefore = async (handler) => {
    if (canPreFetch(options)) {
      await preFetch
    } else if (!client) {
      client = createClient(options, handler)
    }

    const cached = await processCache(options, fetch)

    Object.assign(handler.context, cached)
  }

  return {
    before: secretsManagerMiddlewareBefore
  }
}
