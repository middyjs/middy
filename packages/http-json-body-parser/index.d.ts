import middy from '@middy/core'
import { APIGatewayEvent } from 'aws-lambda'
import { JsonValue } from 'type-fest'

interface Options {
  reviver?: (key: string, value: any) => any
  disableContentTypeError?: boolean
}

export type Event = Omit<APIGatewayEvent, 'body'> & {
  /**
   * The body of the HTTP request.
   */
  body: JsonValue
}

declare function jsonBodyParser (options?: Options): middy.MiddlewareObj<Event>

export default jsonBodyParser
