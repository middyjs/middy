import {
  canPrefetch,
  createPrefetchClient,
  createClient,
  getCache,
  getInternal,
  processCache,
  modifyCache,
  jsonSafeParse
} from '@middy/util'
import {
  SecretsManagerClient,
  DescribeSecretCommand,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager'

const defaults = {
  AwsClient: SecretsManagerClient,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {},
  fetchRotationDate: false, // true: apply to all or {key: true} for individual
  disablePrefetch: false,
  cacheKey: 'secrets-manager',
  cacheKeyExpiry: {},
  cacheExpiry: -1, // ignored when fetchRotationRules is true/object
  setToContext: false
}

const secretsManagerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = (request, cachedValues = {}) => {
    const values = {}

    for (const internalKey of Object.keys(options.fetchData)) {
      if (cachedValues[internalKey]) continue

      values[internalKey] = Promise.resolve()
        .then(() => {
          if (
            options.fetchRotationDate === true ||
            options.fetchRotationDate?.[internalKey]
          ) {
            return client
              .send(
                new DescribeSecretCommand({
                  SecretId: options.fetchData[internalKey]
                })
              )
              .then((resp) => {
                if (options.cacheExpiry < 0) {
                  options.cacheKeyExpiry[internalKey] =
                    resp.NextRotationDate * 1000
                } else {
                  options.cacheKeyExpiry[internalKey] = Math.min(
                    Math.max(resp.LastRotationDate, resp.LastChangedDate) *
                      1000 +
                      options.cacheExpiry,
                    resp.NextRotationDate * 1000
                  )
                }
              })
          }
        })
        .then(() =>
          client.send(
            new GetSecretValueCommand({
              SecretId: options.fetchData[internalKey]
            })
          )
        )
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

  let client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
    processCache(options, fetch)
  }

  const secretsManagerMiddlewareBefore = async (request) => {
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
    before: secretsManagerMiddlewareBefore
  }
}
export default secretsManagerMiddleware
