import middy from '@middy/core'
import { APIGatewayEvent, APIGatewayProxyEventV2 } from 'aws-lambda'
import { JsonValue } from 'type-fest'

interface Options {
  reviver?: (key: string, value: any) => any
  disableContentTypeError?: boolean
}

export type Event<APIGatewayVersionedEvent = APIGatewayEvent | APIGatewayProxyEventV2> = Omit<APIGatewayVersionedEvent, 'body'> & {
  /**
   * The body of the HTTP request.
   */
  body: JsonValue
}

declare function jsonBodyParser<APIGatewayVersionedEvent = APIGatewayEvent | APIGatewayProxyEventV2> (options?: Options): middy.MiddlewareObj<Event<APIGatewayVersionedEvent>>

export default jsonBodyParser
