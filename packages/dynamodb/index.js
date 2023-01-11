import {
  canPrefetch,
  createPrefetchClient,
  createClient,
  getCache,
  getInternal,
  processCache,
  modifyCache
} from '@middy/util'
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

const defaults = {
  AwsClient: DynamoDBClient,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  fetchData: {},
  disablePrefetch: false,
  cacheKey: 'dynamodb',
  cacheExpiry: -1,
  setToContext: false
}
const dynamodbMiddleware = (opts = {}) => {
  const options = {
    ...defaults,
    ...opts
  }

  // force marshall of Key during cold start
  for (const internalKey in options.fetchData) {
    options.fetchData[internalKey].Key = marshall(
      options.fetchData[internalKey].Key
    )
  }

  const fetch = (request, cachedValues = {}) => {
    const values = {}
    for (const internalKey in options.fetchData) {
      if (cachedValues[internalKey]) continue
      const inputParameters = options.fetchData[internalKey]
      values[internalKey] = client
        .send(new GetItemCommand(inputParameters))
        .then((resp) => unmarshall(resp.Item))
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
  const dynamodbMiddlewareBefore = async (request) => {
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
    before: dynamodbMiddlewareBefore
  }
}

export default dynamodbMiddleware
