import { ApiGatewayManagementApiClient } from "@aws-sdk/client-apigatewaymanagementapi";
import type middy from "@middy/core";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expectType } from "tsd";
import wsResponse from ".";

// use with default options
let middleware = wsResponse();
expectType<middy.MiddlewareObj>(middleware);

// use with all options
middleware = wsResponse({
	AwsClient: ApiGatewayManagementApiClient,
	awsClientCapture: captureAWSv3Client,
	disablePrefetch: true,
});
expectType<middy.MiddlewareObj>(middleware);
