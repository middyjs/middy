import middy from '@middy/core'
import { APIGatewayProxyHandlerV2 } from 'aws-lambda'

interface Route<T = never> {
  routeKey: string
  handler: APIGatewayProxyHandlerV2<T>
}

declare function wsRouterHandler (routes: Route[]): middy.MiddyfiedHandler

export default wsRouterHandler
