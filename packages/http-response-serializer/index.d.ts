import middy from '@middy/core'

interface SerializerHandler {
  regex: any;
  serializer: (respones: any) => any;
}

interface IhttpResponseSerializerOptions {
  serializers: Array<SerializerHandler>;
  default?: string;
}

declare function httpResponseSerializer(opts?: IhttpResponseSerializerOptions): middy.IMiddyMiddlewareObject;

export default httpResponseSerializer
