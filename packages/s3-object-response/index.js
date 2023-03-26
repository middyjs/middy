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
    const { inputS3Url, outputRoute, outputToken } =
      request.event.getObjectContext

    request.internal.s3ObjectResponse = {
      RequestRoute: outputRoute,
      RequestToken: outputToken
    }

    request.context.s3ObjectFetch = fetch(inputS3Url)
  }

  const s3ObjectResponseMiddlewareAfter = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }

    if (request.response.body) {
      request.response.Body = request.response.body
      delete request.response.body
    }

    await client.send(
      new WriteGetObjectResponseCommand({
        ...request.internal.s3ObjectResponse,
        ...request.response
      })
    )

    return { statusCode: 200 }
  }

  return {
    before: s3ObjectResponseMiddlewareBefore,
    after: s3ObjectResponseMiddlewareAfter
  }
}

export default s3ObjectResponseMiddleware
