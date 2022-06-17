import middy from '@middy/core'
import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { expectType } from 'tsd'
import wsRouterHandler from '.'

const connectLambdaHandler: APIGatewayProxyHandlerV2 = async () => {
  return {
    statusCode: 200,
    body: 'Connected to websocket'
  }
}

const disconnectLambdaHandler: APIGatewayProxyHandlerV2 = async () => {
  return {
    statusCode: 200,
    body: 'Disconnected to websocket'
  }
}

const middleware = wsRouterHandler([
  {
    routeKey: '$connect',
    handler: connectLambdaHandler
  },
  {
    routeKey: '$disconnect',
    handler: disconnectLambdaHandler
  }
])
expectType<middy.middy.MiddyfiedHandler>(middleware)
