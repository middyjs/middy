import middy from '@middy/core'
import { expectType } from 'tsd'
import jsonBodyParser, { Event } from '.'
import { APIGatewayEvent, APIGatewayProxyEventV2 } from 'aws-lambda'

// use with default options
let middleware = jsonBodyParser()
expectType<middy.MiddlewareObj<Event>>(middleware)

// use with all options
middleware = jsonBodyParser({
  reviver: (key: string, value: any) => Boolean(value)
})
expectType<middy.MiddlewareObj<Event>>(middleware)

// allow specifying the event type
const apiGatewayV1Middleware = jsonBodyParser<APIGatewayEvent>()
expectType<middy.MiddlewareObj<Event<APIGatewayEvent>>>(apiGatewayV1Middleware)
const apiGatewayV2Middleware = jsonBodyParser<APIGatewayProxyEventV2>()
expectType<middy.MiddlewareObj<Event<APIGatewayProxyEventV2>>>(apiGatewayV2Middleware)
