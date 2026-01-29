// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	APIGatewayEvent,
	APIGatewayProxyEventMultiValueQueryStringParameters,
	APIGatewayProxyEventPathParameters,
	APIGatewayProxyEventQueryStringParameters,
	// TODO add in VPC Lattice event
} from "aws-lambda";

export type Event = APIGatewayEvent & {
	multiValueQueryStringParameters: APIGatewayProxyEventMultiValueQueryStringParameters;
	pathParameters: APIGatewayProxyEventPathParameters;
	queryStringParameters: APIGatewayProxyEventQueryStringParameters;
};

declare function httpEventNormalizer(): middy.MiddlewareObj<Event>;

export default httpEventNormalizer;
