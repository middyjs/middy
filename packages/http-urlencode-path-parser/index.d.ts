import middy from '@middy/core'
import { APIGatewayEvent } from 'aws-lambda'
import { JsonValue } from 'type-fest'

export type Event = APIGatewayEvent & {
  body: JsonValue
}

declare function urlEncodePathParser(): middy.MiddlewareObj<Event>

export default urlEncodePathParser
