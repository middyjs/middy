import middy from '@middy/core'
import { APIGatewayEvent } from 'aws-lambda'
import { JsonValue } from 'type-fest'

export type Event = APIGatewayEvent & {
  body: JsonValue
}

declare function urlEncodeBodyParser(): middy.MiddlewareObj<Event>

export default urlEncodeBodyParser
