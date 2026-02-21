// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type middy from "@middy/core";
import type {
	APIGatewayEvent,
	APIGatewayProxyEventMultiValueQueryStringParameters,
	APIGatewayProxyEventPathParameters,
	APIGatewayProxyEventQueryStringParameters,
} from "aws-lambda";

// TODO: Import from 'aws-lambda' when @types/aws-lambda adds VPC Lattice types
// https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/aws-lambda
export interface VPCLatticeEvent {
	body: string | null;
	headers: { [name: string]: string | undefined };
	is_base64_encoded: boolean;
	isBase64Encoded: boolean;
	method: string;
	path: string;
	pathParameters: APIGatewayProxyEventPathParameters;
	query_string_parameters: APIGatewayProxyEventQueryStringParameters | null;
	queryStringParameters: APIGatewayProxyEventQueryStringParameters;
}

export type Event = APIGatewayEvent & {
	multiValueQueryStringParameters: APIGatewayProxyEventMultiValueQueryStringParameters;
	pathParameters: APIGatewayProxyEventPathParameters;
	queryStringParameters: APIGatewayProxyEventQueryStringParameters;
};

declare function httpEventNormalizer(): middy.MiddlewareObj<Event>;

export default httpEventNormalizer;
