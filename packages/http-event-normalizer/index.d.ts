import middy from '@middy/core'
import {
  APIGatewayEvent,
  APIGatewayProxyEventMultiValueQueryStringParameters,
  APIGatewayProxyEventPathParameters,
  APIGatewayProxyEventQueryStringParameters
} from 'aws-lambda'

export type Event = APIGatewayEvent & {
  multiValueQueryStringParameters: APIGatewayProxyEventMultiValueQueryStringParameters
  pathParameters: APIGatewayProxyEventPathParameters
  queryStringParameters: APIGatewayProxyEventQueryStringParameters
}

declare function httpEventNormalizer (): middy.MiddlewareObj<Event>

export default httpEventNormalizer
