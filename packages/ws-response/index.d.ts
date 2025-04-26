import type {
	ApiGatewayManagementApiClient,
	ApiGatewayManagementApiClientConfig,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type middy from "@middy/core";
import type { Options as MiddyOptions } from "@middy/util";

interface Options<
	AwsApiGatewayManagementApiClient = ApiGatewayManagementApiClient,
> extends Pick<
		MiddyOptions<
			AwsApiGatewayManagementApiClient,
			ApiGatewayManagementApiClientConfig
		>,
		| "AwsClient"
		| "awsClientOptions"
		| "awsClientAssumeRole"
		| "awsClientCapture"
		| "disablePrefetch"
	> {}

declare function wsResponse(options?: Options): middy.MiddlewareObj;

export default wsResponse;
