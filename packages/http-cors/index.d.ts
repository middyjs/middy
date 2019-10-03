import middy from '@middy/core'

interface ICorsOptions {
  origin?: string;
  origins?: string[];
  headers?: string;
  credentials?: boolean;
}

declare const cors : middy.Middleware<ICorsOptions, any, any>

export default cors
