import middy from '@middy/core'
import { APIGatewayEvent } from 'aws-lambda'
import { JsonValue } from 'type-fest'

interface Options {
  disableContentTypeError?: boolean
}

export type Event = APIGatewayEvent & {
  body: JsonValue
}

declare function urlEncodeBodyParser(
  options?: Options
): middy.MiddlewareObj<Event>

export default urlEncodeBodyParser
