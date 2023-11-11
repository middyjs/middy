import middy from '@middy/core'
import { APIGatewayEvent, APIGatewayProxyEventV2 } from 'aws-lambda'

interface Options {
  reviver?: (key: string, value: any) => any
  disableContentTypeError?: boolean
}

type VersionedApiGatewayEvent = APIGatewayEvent | APIGatewayProxyEventV2

declare function jsonBodyParser<APIGatewayEventType extends VersionedApiGatewayEvent = VersionedApiGatewayEvent> (options?: Options): middy.MiddlewareObj<Event<APIGatewayEventType>>

export default jsonBodyParser
