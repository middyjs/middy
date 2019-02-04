let secretsManagerInstance

module.exports = opts => {
  const defaults = {
    awsSdkOptions: {},
    secrets: {}, // e.g. { RDS_SECRET: 'dev/rds_login', API_SECRET: '...' }
    throwOnFailedCall: false,
    cache: false,
    cacheExpiryInMillis: undefined,
    secretsLoaded: false,
    secretsCache: undefined,
    secretsLoadedAt: new Date(0)
  }

  const options = Object.assign({}, defaults, opts)

  return {
    before: (handler, next) => {
      // if there're cached secrets already, then use it in case refresh fails
      if (options.secretsCache) {
        options.secretsCache.forEach(object => {
          Object.assign(handler.context, object)
        })
      }

      if (!shouldFetchFromSecretsManager(options)) {
        return next()
      }

      secretsManagerInstance =
        secretsManagerInstance ||
        getSecretsManagerInstance(options.awsSdkOptions)
      const secretsPromises = Object.keys(options.secrets).map(key => {
        const secretName = options.secrets[key]
        return secretsManagerInstance
          .getSecretValue({ SecretId: secretName })
          .promise()
          .then(resp => {
            const secret = JSON.parse(resp.SecretString || '{}')
            const object = {}
            object[key] = secret
            return object
          })
      })

      return Promise.all(secretsPromises)
        .then(objectsToMap => {
          objectsToMap.forEach(object => {
            Object.assign(handler.context, object)
          })

          options.secretsLoaded = true
          options.secretsCache = objectsToMap
          options.secretsLoadedAt = new Date()
        })
        .catch(err => {
          console.error(
            'failed to refresh secrets from Secrets Manager:',
            err.message
          )
          // if we already have a cached secrets, then reset the timestamp so we don't
          // keep retrying on every invocation which can cause performance problems
          // when there's temporary problems with Secrets Manager
          if (options.throwOnFailedCall && !options.secretsCache) {
            throw err
          }

          if (options.secretsCache) {
            options.secretsLoadedAt = new Date()
          }
        })
    }
  }
}

const shouldFetchFromSecretsManager = ({
  secretsLoaded,
  secretsLoadedAt,
  cache,
  cacheExpiryInMillis
}) => {
  // if caching is OFF, or we haven't loaded anything yet, then definitely load it from SecretsManager
  if (!cache || !secretsLoaded) {
    return true
  }

  // if caching is ON, and cache expiration is ON, and enough time has passed, then also load it from SecretsManager
  const now = new Date()
  const millisSinceLastLoad = now.getTime() - secretsLoadedAt.getTime()
  if (cacheExpiryInMillis && millisSinceLastLoad > cacheExpiryInMillis) {
    return true
  }

  // otherwise, don't bother
  return false
}

/**
 * Lazily load aws-sdk and initialize SecretsManager constructor
 * to avoid performance penalties for those who doesn't use
 * this middleware. Sets secretsManagerInstance var at the top of the module
 * or returns if it's already initialized
 * @param {Object} awsSdkOptions Options to use to initialize aws sdk constructor
 */
const getSecretsManagerInstance = awsSdkOptions => {
  // lazy load aws-sdk and SecretsManager constructor to avoid performance
  // penalties if you don't use this middleware

  // AWS Lambda has aws-sdk included version 2.176.0
  // see https://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html
  const { SecretsManager } = require('aws-sdk')
  return new SecretsManager(awsSdkOptions)
}
