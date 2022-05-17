import middy from '@middy/core'
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler as LambdaHandler
} from 'aws-lambda'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'ANY'

interface Route {
  method: Method
  path: string
  handler: LambdaHandler<APIGatewayProxyEvent, APIGatewayProxyResult>
}

declare function httpRouterHandler (routes: Route[]): middy.MiddlewareObj

export default httpRouterHandler
