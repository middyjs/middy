import middy from '@middy/core'
import { APIGatewayEvent, APIGatewayProxyEventV2, ALBEvent } from 'aws-lambda'

interface Options {
  reviver?: (key: string, value: any) => any
  disableContentTypeError?: boolean
}

export type VersionedApiGatewayEvent = APIGatewayEvent | APIGatewayProxyEventV2

declare function jsonBodyParser<EventType extends VersionedApiGatewayEvent | ALBEvent = VersionedApiGatewayEvent | ALBEvent> (options?: Options): middy.MiddlewareObj<EventType>

export default jsonBodyParser
