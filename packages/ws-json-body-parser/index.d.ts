import middy from '@middy/core'
import { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { JsonValue } from 'type-fest'

interface Options {
  reviver?: (key: string, value: any) => any
}

export type Event = Omit<APIGatewayProxyWebsocketEventV2, 'body'> & {
  body: JsonValue
}

declare function jsonBodyParser (options?: Options): middy.MiddlewareObj<Event>

export default jsonBodyParser
