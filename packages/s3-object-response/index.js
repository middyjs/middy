import { canPrefetch, createPrefetchClient, createClient } from '@middy/util'

import { S3Client, WriteGetObjectResponseCommand } from '@aws-sdk/client-s3'

const defaults = {
  AwsClient: S3Client,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  disablePrefetch: false
}

const s3ObjectResponseMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  let client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
  }

  const s3ObjectResponseMiddlewareBefore = async (request) => {
    const { inputS3Url } = request.event.getObjectContext

    request.context.s3ObjectFetch = fetch(inputS3Url)
  }

  const s3ObjectResponseMiddlewareAfter = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }

    request.response.RequestRoute = request.event.getObjectContext.outputRoute
    request.response.RequestToken = request.event.getObjectContext.outputToken

    if (request.response.body) {
      request.response.Body = request.response.body
      delete request.response.body
    }

    await client.send(
      new WriteGetObjectResponseCommand(request.internal.s3ObjectResponse)
    )

    return { statusCode: 200 }
  }

  return {
    before: s3ObjectResponseMiddlewareBefore,
    after: s3ObjectResponseMiddlewareAfter
  }
}

export default s3ObjectResponseMiddleware
