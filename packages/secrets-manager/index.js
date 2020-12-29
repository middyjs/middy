import { canPrefetch, createClient, processCache, jsonSafeParse } from '../core/util.js'
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
          return { [contextKey]: jsonSafeParse(resp) }
        })
    }))

    return Object.assign({}, ...values)
  }

  let prefetch, client
  if (canPrefetch(options)) {
    client = createClient(options)
    prefetch = processCache(options, fetch)
  }

  const secretsManagerMiddlewareBefore = async (handler) => {
    if (canPrefetch(options)) {
      await prefetch
    } else if (!client) {
      client = createClient(options, handler)
    }

    const cached = await processCache(options, fetch, handler)

    Object.assign(handler.context, cached)
  }

  return {
    before: secretsManagerMiddlewareBefore
  }
}
