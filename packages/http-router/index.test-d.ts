import { expectType } from 'tsd'
import middy from '@middy/core'
import httpRouterHandler from '.'
import {
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    Handler as LambdaHandler
  } from 'aws-lambda'

const lambdaHandler: LambdaHandler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    return {
      statusCode: 200,
      body: `Hello from method ${event.httpMethod} on path ${event.path}`
    }
  }

const middleware = httpRouterHandler([
    {
        'method': 'GET',
        'path': '/',
        handler: lambdaHandler
    }
])
expectType<middy.MiddlewareObj>(middleware)
