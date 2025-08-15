import middy from "@middy/core";
import type {
	ALBEvent,
	APIGatewayEvent,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import { expect } from "tstyche";
import jsonBodyParser from "./index.js";

// use with default options
let middleware = jsonBodyParser();
expect(middleware).type.toBe<
	middy.MiddlewareObj<APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent>
>();

// use with all options
middleware = jsonBodyParser({
	reviver: (_key: string, value: any) => Boolean(value),
});
expect(middleware).type.toBe<
	middy.MiddlewareObj<APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent>
>();

const baseEvent: Omit<APIGatewayEvent, "body"> = {
	headers: {},
	isBase64Encoded: false,
	httpMethod: "GET",
	path: "/",
	multiValueHeaders: {},
	pathParameters: null,
	queryStringParameters: null,
	multiValueQueryStringParameters: null,
	stageVariables: null,
	requestContext: {
		accountId: "",
		apiId: "",
		authorizer: null,
		protocol: "",
		httpMethod: "",
		path: "",
		stage: "",
		requestId: "",
		requestTimeEpoch: 0,
		resourceId: "",
		resourcePath: "",
		identity: {
			accessKey: null,
			accountId: null,
			apiKey: null,
			apiKeyId: null,
			caller: null,
			clientCert: null,
			cognitoAuthenticationProvider: null,
			cognitoAuthenticationType: null,
			cognitoIdentityId: null,
			cognitoIdentityPoolId: null,
			principalOrgId: null,
			sourceIp: "",
			user: null,
			userAgent: null,
			userArn: null,
		},
	},
	resource: "",
};

// allow body to only be string or null
middleware = jsonBodyParser();
const middifiedHandler = middy(() => {}).use(middleware);

expect(middifiedHandler).type.toBeCallableWith(
	{
		...baseEvent,
		body: "string",
	},
	{} as any,
);

expect(middifiedHandler).type.toBeCallableWith(
	{
		...baseEvent,
		body: null,
	},
	{} as any,
);

expect(middifiedHandler).type.not.toBeCallableWith(
	{
		...baseEvent,
		body: {},
	},
	{} as any,
);

// allow specifying the event type
const apiGatewayV1Middleware = jsonBodyParser<APIGatewayEvent>();
expect(apiGatewayV1Middleware).type.toBe<
	middy.MiddlewareObj<APIGatewayEvent>
>();
const apiGatewayV2Middleware = jsonBodyParser<APIGatewayProxyEventV2>();
expect(apiGatewayV2Middleware).type.toBe<
	middy.MiddlewareObj<APIGatewayProxyEventV2>
>();
const albMiddleware = jsonBodyParser<ALBEvent>();
expect(albMiddleware).type.toBe<middy.MiddlewareObj<ALBEvent>>();
