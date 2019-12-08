import middy from '../core'

interface IURLEncodeBodyParserOptions {
  extended?: boolean;
}

declare function urlEncodeBodyParser(opts?: IURLEncodeBodyParserOptions): middy.IMiddyMiddlewareObject;

export default urlEncodeBodyParser
