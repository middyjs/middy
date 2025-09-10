import { ApiGatewayManagementApiClient } from "@aws-sdk/client-apigatewaymanagementapi";
import type middy from "@middy/core";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import wsResponse from "./index.js";

test("use with default options", () => {
	const middleware = wsResponse();
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});

test("use with all options", () => {
	const middleware = wsResponse({
		AwsClient: ApiGatewayManagementApiClient,
		awsClientCapture: captureAWSv3Client,
		disablePrefetch: true,
	});
	expect(middleware).type.toBe<middy.MiddlewareObj>();
});
