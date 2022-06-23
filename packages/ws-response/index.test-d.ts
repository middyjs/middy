import { expectType } from 'tsd'
import middy from '@middy/core'
import ApiGatewayManagementApi from 'aws-sdk/clients/apigatewaymanagementapi'
import { captureAWSClient } from 'aws-xray-sdk'
import wsResponse from '.'

// use with default options
let middleware = wsResponse()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = wsResponse({
  AwsClient: ApiGatewayManagementApi,
  awsClientCapture: captureAWSClient,
  disablePrefetch: true
})
expectType<middy.MiddlewareObj>(middleware)
