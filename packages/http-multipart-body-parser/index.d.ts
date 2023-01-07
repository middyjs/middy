import middy from '@middy/core'
import { APIGatewayEvent } from 'aws-lambda'
import { JsonValue } from 'type-fest'

interface Options {
  busboy?: {
    headers?: any
    highWaterMark?: number
    fileHwm?: number
    defCharset?: string
    preservePath?: boolean
    limits?: {
      fieldNameSize?: number
      fieldSize?: number
      fields?: number
      fileSize?: number
      files?: number
      parts?: number
      headerPairs?: number
    }
  }
  charset?: string
  disableContentTypeError?: boolean
}

export type Event = Omit<APIGatewayEvent, 'body'> & {
  body: JsonValue
}

declare function multipartBodyParser (
  options?: Options
): middy.MiddlewareObj<Event>

export default multipartBodyParser
