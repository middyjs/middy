import type middy from "@middy/core";
import type {
	ALBEvent,
	ALBEventMultiValueQueryStringParameters,
	ALBEventQueryStringParameters,
	APIGatewayEvent,
	APIGatewayProxyEventMultiValueQueryStringParameters,
	APIGatewayProxyEventPathParameters,
	APIGatewayProxyEventQueryStringParameters,
	APIGatewayProxyEventV2,
} from "aws-lambda";
import { expect, test } from "tstyche";
import httpEventNormalizer, { type VPCLatticeEvent } from "./index.js";

test("use with default options", () => {
	const middleware = httpEventNormalizer();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			| (APIGatewayEvent & {
					multiValueQueryStringParameters: APIGatewayProxyEventMultiValueQueryStringParameters;
					pathParameters: APIGatewayProxyEventPathParameters;
					queryStringParameters: APIGatewayProxyEventQueryStringParameters;
			  })
			| (APIGatewayProxyEventV2 & {
					pathParameters: Record<string, string>;
					queryStringParameters: Record<string, string>;
			  })
			| (ALBEvent & {
					multiValueQueryStringParameters: ALBEventMultiValueQueryStringParameters;
					pathParameters: APIGatewayProxyEventPathParameters;
					queryStringParameters: ALBEventQueryStringParameters;
			  })
			| VPCLatticeEvent,
			unknown,
			Error
		>
	>();
});

test("use with V1 event type", () => {
	const middleware = httpEventNormalizer<APIGatewayEvent>();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayEvent & {
				multiValueQueryStringParameters: APIGatewayProxyEventMultiValueQueryStringParameters;
				pathParameters: APIGatewayProxyEventPathParameters;
				queryStringParameters: APIGatewayProxyEventQueryStringParameters;
			},
			unknown,
			Error
		>
	>();
});

test("use with V2 event type", () => {
	const middleware = httpEventNormalizer<APIGatewayProxyEventV2>();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			APIGatewayProxyEventV2 & {
				pathParameters: Record<string, string>;
				queryStringParameters: Record<string, string>;
			},
			unknown,
			Error
		>
	>();
});

test("use with ALB event type", () => {
	const middleware = httpEventNormalizer<ALBEvent>();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			ALBEvent & {
				multiValueQueryStringParameters: ALBEventMultiValueQueryStringParameters;
				pathParameters: APIGatewayProxyEventPathParameters;
				queryStringParameters: ALBEventQueryStringParameters;
			},
			unknown,
			Error
		>
	>();
});

test("use with VPC Lattice event type", () => {
	const middleware = httpEventNormalizer<VPCLatticeEvent>();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<VPCLatticeEvent, unknown, Error>
	>();
});

test("VPCLatticeEvent type is exported", () => {
	const event: VPCLatticeEvent = {
		body: null,
		headers: {},
		is_base64_encoded: false,
		isBase64Encoded: false,
		method: "GET",
		path: "/",
		pathParameters: {},
		query_string_parameters: null,
		queryStringParameters: {},
	};
	expect(event).type.toBe<VPCLatticeEvent>();
});
