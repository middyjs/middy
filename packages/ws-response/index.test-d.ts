import { ApiGatewayManagementApiClient } from "@aws-sdk/client-apigatewaymanagementapi";
import type middy from "@middy/core";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect } from "tstyche";
import wsResponse from "./index.js";

// use with default options
let middleware = wsResponse();
expect(middleware).type.toBe<middy.MiddlewareObj>();

// use with all options
middleware = wsResponse({
	AwsClient: ApiGatewayManagementApiClient,
	awsClientCapture: captureAWSv3Client,
	disablePrefetch: true,
});
expect(middleware).type.toBe<middy.MiddlewareObj>();
