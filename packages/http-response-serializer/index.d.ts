import middy from '@middy/core'

interface SerializerHandler {
  regex: any
  serializer: (respones: any) => any
}

interface IHttpResponseSerializerOptions {
  serializers: SerializerHandler[]
  default?: string
}

declare const httpResponseSerializer: middy.Middleware<IHttpResponseSerializerOptions, any, any>

export default httpResponseSerializer
