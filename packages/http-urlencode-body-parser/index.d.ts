import middy from '../core'

interface IURLEncodeBodyParserOptions {
  extended?: false;
}

declare function urlEncodeBodyParser(opts?: IURLEncodeBodyParserOptions): middy.IMiddyMiddlewareObject;

export default urlEncodeBodyParser
