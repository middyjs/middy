import { expectType } from 'tsd'
import middy from '@middy/core'
import { ApiGatewayManagementApiClient } from '@aws-sdk/client-apigatewaymanagementapi'
import { captureAWSv3Client } from 'aws-xray-sdk'
import wsResponse from '.'

// use with default options
let middleware = wsResponse()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = wsResponse({
  AwsClient: ApiGatewayManagementApiClient,
  awsClientCapture: captureAWSv3Client,
  disablePrefetch: true
})
expectType<middy.MiddlewareObj>(middleware)
