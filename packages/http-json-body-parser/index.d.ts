import middy from '@middy/core'
import { APIGatewayEvent, APIGatewayProxyEventV2 } from 'aws-lambda'

interface Options {
  reviver?: (key: string, value: any) => any
  disableContentTypeError?: boolean
}

declare function jsonBodyParser (options?: Options): middy.MiddlewareObj<APIGatewayEvent | APIGatewayProxyEventV2>

export default jsonBodyParser
