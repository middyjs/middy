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
