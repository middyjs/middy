import middy from '@middy/core'
import { S3Client } from '@aws-sdk/client-s3'
import { captureAWSv3Client } from 'aws-xray-sdk'
import { Context as LambdaContext } from 'aws-lambda'
import { expectType } from 'tsd'
import s3ObjectResponse, { S3ObjectResponseOptions, Context, Internal } from '.'
import { getInternal } from '@middy/util'
import { ClientRequest } from 'http'

// use with default options
let middleware = s3ObjectResponse()
expectType<middy.MiddlewareObj<unknown, any, Error, Context<S3ObjectResponseOptions<S3Client> | undefined>, Internal>>(
  middleware
)

// use with all options
middleware = s3ObjectResponse({
  AwsClient: S3Client,
  awsClientCapture: captureAWSv3Client,
  disablePrefetch: true
})
expectType<middy.MiddlewareObj<unknown, any, Error, Context<S3ObjectResponseOptions<S3Client> | undefined>, Internal>>(
  middleware
)

const handler = middy(async (event: {}, context: LambdaContext) => {
  return await Promise.resolve({})
})

// use with bodyType: 'stream'
handler.use(
  s3ObjectResponse({
    AwsClient: S3Client,
    awsClientCapture: captureAWSv3Client,
    disablePrefetch: true,
    bodyType: 'stream'
  })
)
  .before(async (request) => {
    expectType<ClientRequest>(request.context.s3Object)
    expectType<Promise<Response>>(request.context.s3ObjectFetch)

    const data = await getInternal('s3ObjectResponse', request)
    expectType<{
      RequestRoute: string
      RequestToken: string
    }>(data.s3ObjectResponse)
  })

// use with bodyType: 'promise'
handler.use(
  s3ObjectResponse({
    AwsClient: S3Client,
    awsClientCapture: captureAWSv3Client,
    disablePrefetch: true,
    bodyType: 'promise'
  })
)
  .before(async (request) => {
    expectType<Promise<any>>(request.context.s3Object)
    expectType<Promise<Response>>(request.context.s3ObjectFetch)

    const data = await getInternal('s3ObjectResponse', request)
    expectType<{
      RequestRoute: string
      RequestToken: string
    }>(data.s3ObjectResponse)
  })
