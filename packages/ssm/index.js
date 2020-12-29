import { canPrefetch, createClient, processCache, jsonSafeParse } from '../core/util.js'
import { SSM } from '@aws-sdk/client-ssm'

const defaults = {
  awsClientConstructor: SSM, // Allow for XRay
  awsClientOptions: {
    maxRetries: 6, // lowers a chance to hit service rate limits, default is 3
    retryDelayOptions: { base: 200 }
  },
  awsClientAssumeRole: undefined,
  fetchData: {},  // { contextKey: fetchKey, contextPrefix: fetchPath/ }
  cacheKey: 'secrets-manager',
  cacheExpiry: 0,
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const fetch = async () => {
    let values = await Promise.all(Object.keys(options.fetchData).map((contextKey) => {
      const path = options.fetchData[contextKey]
      if (path.substr(-1) === '/') {
        return fetchPath(contextKey, path.substr(0, -1))
      } else {
        return fetchSingle(contextKey, path)
      }

    }))
    return Object.assign({}, ...values.flat())
  }

  const fetchSingle = async (contextKey, path) => {
    return client
      .getParameters({ Names: options.fetchData[contextKey], WithDecryption: true })
      .then(resp => {
        if (resp.InvalidParameters?.length) {
          throw new Error(
            `InvalidParameters present: ${resp.InvalidParameters.join(', ')}`
          )
        }
        return { [contextKey]: jsonSafeParse(resp.Value) }
      })
  }

  const fetchPath = async (contextKeyPrefix, path, nextToken) => {
    const resp = await client
      .getParametersByPath({
        Path: path,
        NextToken: nextToken,
        Recursive: true,
        WithDecryption: true
      })

    const additionalParams = resp.NextToken
      ? await fetchPath(path, resp.NextToken)
      : []

    return [
      ...additionalParams,
      ...Object.keys(resp.Parameters).map(param => {
        const contextKey = contextKeyPrefix + param.split(`${path}/`)
          .join('') // replace path
          .split('/')
          .join('_') // replace remaining slashes with underscores
        return { [contextKey]: jsonSafeParse(resp.Parameters[param].Value) }
      })
    ]
  }

  let prefetch, client
  if (canPrefetch(options)) {
    client = createClient(options)
    prefetch = processCache(options, fetch)
  }

  const ssmMiddlewareBefore = async (handler) => {
    if (canPrefetch(options)) {
      await prefetch
    } else if (!client) {
      client = createClient(options, handler)
    }

    const cached = await processCache(options, fetch, handler)

    Object.assign(handler.context, cached)
  }

  return {
    before:ssmMiddlewareBefore
  }
}
