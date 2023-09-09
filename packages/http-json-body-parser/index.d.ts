import middy from '@middy/core'
import { APIGatewayEvent, APIGatewayProxyEventV2 } from 'aws-lambda'
import { JsonValue } from 'type-fest'

interface Options {
  reviver?: (key: string, value: any) => any
  disableContentTypeError?: boolean
}

type VersionedApiGatewayEvent = APIGatewayEvent | APIGatewayProxyEventV2

export type Event<APIGatewayEventType extends VersionedApiGatewayEvent = VersionedApiGatewayEvent> = Omit<APIGatewayEventType, 'body'> & {
  /**
   * The body of the HTTP request.
   */
  body: JsonValue
}

declare function jsonBodyParser<APIGatewayEventType extends VersionedApiGatewayEvent = VersionedApiGatewayEvent> (options?: Options): middy.MiddlewareObj<Event<APIGatewayEventType>>

export default jsonBodyParser
