import middy from '@middy/core'
import { APIGatewayEvent, APIGatewayProxyEventV2, ALBEvent } from 'aws-lambda'

interface Options {
  reviver?: (key: string, value: any) => any
  disableContentTypeError?: boolean
}

export type RequestEvent = APIGatewayEvent | APIGatewayProxyEventV2 | ALBEvent

declare function jsonBodyParser<EventType extends RequestEvent = RequestEvent> (options?: Options): middy.MiddlewareObj<EventType>

export default jsonBodyParser
