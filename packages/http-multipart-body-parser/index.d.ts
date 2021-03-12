import middy from '@middy/core'

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
}

declare function multipartBodyParser (options?: Options): middy.MiddlewareObj

export default multipartBodyParser
