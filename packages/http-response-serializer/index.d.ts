import middy from '@middy/core'

interface SerializerHandler {
  regex: RegExp
  serializer: (respones: any) => string
}

interface Options {
  serializers: SerializerHandler[]
  default?: string
}

declare function httpResponseSerializer (options?: Options): middy.MiddlewareObj

export default httpResponseSerializer
