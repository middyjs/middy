import middy from '@middy/core'

interface ICorsOptions {
  origin?: string;
  origins?: string[];
  headers?: string;
  credentials?: boolean;
}

declare function cors(opts?: ICorsOptions): middy.IMiddyMiddlewareObject;

export default cors
