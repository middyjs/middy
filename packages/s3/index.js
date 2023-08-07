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
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
const defaults = {
  AwsClient: S3Client,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {},
  disablePrefetch: false,
  cacheKey: 's3',
  cacheKeyExpiry: {},
  cacheExpiry: -1,
  setToContext: false
}
const contentTypePattern = /^application\/(.+\+)?json($|;.+)/
const s3Middleware = (opts = {}) => {
  const options = {
    ...defaults,
    ...opts
  }
  const fetch = (request, cachedValues = {}) => {
    const values = {}
    for (const internalKey of Object.keys(options.fetchData)) {
      if (cachedValues[internalKey]) continue
      values[internalKey] = client
        .send(
          new GetObjectCommand({
            ...options.fetchData[internalKey],
            ChecksumMode: true
          })
        )
        .then(async (resp) => {
          let value = await resp.Body.transformToString()
          if (contentTypePattern.test(resp.headers.ContentType)) {
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
  const s3MiddlewareBefore = async (request) => {
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
    before: s3MiddlewareBefore
  }
}
export default s3Middleware
