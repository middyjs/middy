import middy from '@middy/core'
import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda'

interface Route<T = never> {
  routeKey: string
  handler: APIGatewayProxyWebsocketHandlerV2<T>
}

declare function wsRouterHandler (routes: Route[]): middy.MiddyfiedHandler

export default wsRouterHandler
