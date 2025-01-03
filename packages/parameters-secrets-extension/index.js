import {
  canPrefetch,
  processCache,
  getCache,
  modifyCache,
  getInternal,
  jsonSafeParse
} from '../util/index.js'

const defaults = {
  type: undefined, // systemsmanager, secretsmanager
  fetchData: {},
  disablePrefetch: false,
  cacheKey: 'lambda-extension',
  cacheKeyExpiry: {},
  cacheExpiry: -1,
  setToContext: false
}

const types = {
  systemsmanager: {
    path: '/systemsmanager/parameters/get/?name=',
    response: (res) => jsonSafeParse(res.Parameter?.Value)
  },
  secretsmanager: {
    path: '/secretsmanager/get?secretId=',
    response: (res) => jsonSafeParse(res.SecretString)
  }
}

const parametersSecretsLambdaExtensionMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const port = process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? 2773
  const url = 'http://localhost:' + port + types[options.type].path
  const headers = {
    'X-Aws-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN
  }
  const fetchRequest = (request, cachedValues = {}) => {
    const values = {}

    for (const internalKey of Object.keys(options.fetchData)) {
      if (cachedValues[internalKey]) continue

      values[internalKey] = fetch(url + options.fetchData[internalKey], {
        headers
      })
        .then((res) => res.json())
        .then((res) => types[options.type].response(res))
        .catch((e) => {
          const value = getCache(options.cacheKey).value ?? {}
          value[internalKey] = undefined
          modifyCache(options.cacheKey, value)
          throw e
        })
    }
    return values
  }

  if (canPrefetch(options)) {
    processCache(options, fetchRequest)
  }

  const parametersSecretsLambdaExtensionMiddlewareBefore = async (request) => {
    const { value } = processCache(options, fetchRequest, request)

    Object.assign(request.internal, value)

    if (options.setToContext) {
      const data = await getInternal(Object.keys(options.fetchData), request)
      Object.assign(request.context, data)
    }
  }

  return {
    before: parametersSecretsLambdaExtensionMiddlewareBefore
  }
}
export default parametersSecretsLambdaExtensionMiddleware
