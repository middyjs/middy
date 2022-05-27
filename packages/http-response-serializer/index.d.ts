import middy from '@middy/core'

interface SerializerHandler {
  regex: RegExp
  serializer: (response: any) => string
}

interface Options {
  serializers: SerializerHandler[]
  defaultContentType?: string
}

declare function httpResponseSerializer (options?: Options): middy.MiddlewareObj

export default httpResponseSerializer
