import { ApiGatewayManagementApiClient } from "@aws-sdk/client-apigatewaymanagementapi";
import type middy from "@middy/core";
import { captureAWSv3Client } from "aws-xray-sdk";
import { expect, test } from "tstyche";
import wsResponse, * as indexModule from "./index.js";

test("use with default options", () => {
	const middleware = wsResponse();
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("use with all options", () => {
	const middleware = wsResponse({
		AwsClient: ApiGatewayManagementApiClient,
		awsClientOptions: {},
		awsClientAssumeRole: "some-role",
		awsClientCapture: captureAWSv3Client,
		disablePrefetch: true,
	});
	expect(middleware).type.toBe<middy.MiddlewareObj<unknown, unknown, Error>>();
});

test("wsResponseValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.wsResponseValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("rejects misspelled option", () => {
	expect(wsResponse).type.not.toBeCallableWith({ awsClientOption: {} });
});
