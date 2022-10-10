import { ApiGatewayManagementApiClient } from '@aws-sdk/client-apigatewaymanagementapi'
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'

interface Options<S = ApiGatewayManagementApiClient>
  extends Pick<
  MiddyOptions<S, ApiGatewayManagementApiClient.Types.ClientConfiguration>,
  | 'AwsClient'
  | 'awsClientOptions'
  | 'awsClientAssumeRole'
  | 'awsClientCapture'
  | 'disablePrefetch'
  > {}

declare function wsResponse (options?: Options): middy.MiddlewareObj

export default wsResponse
