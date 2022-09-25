import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import middy from '@middy/core'
import { Options as MiddyOptions } from '@middy/util'

interface Options<S = ApiGatewayManagementApi>
  extends Pick<MiddyOptions<S, ApiGatewayManagementApi.Types.ClientConfiguration>,
  'AwsClient' | 'awsClientOptions' | 'awsClientAssumeRole' | 'awsClientCapture' | 'disablePrefetch'> {
}

declare function wsResponse (options?: Options): middy.MiddlewareObj

export default wsResponse
