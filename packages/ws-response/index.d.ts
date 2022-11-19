import { ApiGatewayManagementApiClient, ApiGatewayManagementApiClientConfig } from '@aws-sdk/client-apigatewaymanagementapi'
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'

interface Options<
  AwsApiGatewayManagementApiClient = ApiGatewayManagementApiClient
> extends Pick<
  MiddyOptions<
  AwsApiGatewayManagementApiClient,
  ApiGatewayManagementApiClientConfig
  >,
  | 'AwsClient'
  | 'awsClientOptions'
  | 'awsClientAssumeRole'
  | 'awsClientCapture'
  | 'disablePrefetch'
  > {}

declare function wsResponse (options?: Options): middy.MiddlewareObj

export default wsResponse
