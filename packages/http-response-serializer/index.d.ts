import middy from '@middy/core'

interface SerializerHandler {
  regex: any;
  serializer: (respones: any) => any;
}

interface IhttpResponseSerializerOptions {
  serializers: Array<SerializerHandler>;
  default?: string;
}

declare const httpResponseSerializer : middy.Middleware<IhttpResponseSerializerOptions, any, any>

export default httpResponseSerializer
