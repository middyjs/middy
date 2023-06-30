import { expectType } from 'tsd'
import middy from '@middy/core'
import httpRouterHandler from '.'
import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyResultV2,
  Handler as LambdaHandler
} from 'aws-lambda'

const lambdaHandler: LambdaHandler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
  return {
    statusCode: 200,
    body: 'Hello world'
  }
}

const middleware = httpRouterHandler([
  {
    method: 'GET',
    path: '/',
    handler: lambdaHandler
  }
])
expectType<middy.MiddyfiedHandler>(middleware)

const lambdaHandlerV2: LambdaHandler<APIGatewayProxyEventV2, APIGatewayProxyResultV2> = async (event) => {
  return {
    statusCode: 200,
    body: 'Hello world'
  }
}

const middlewareV2 = httpRouterHandler([
  {
    method: 'GET',
    path: '/',
    handler: lambdaHandlerV2
  }
])
expectType<middy.MiddyfiedHandler>(middlewareV2)
