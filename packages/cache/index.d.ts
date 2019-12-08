import middy from '@middy/core'

interface ICacheOptions {
  calculateCacheId?: (event: any) => Promise<string>;
  getValue?: (key: string) => Promise<any>;
  setValue?: (key: string) => Promise<void>;
}

declare const cache : middy.Middleware<ICacheOptions, any, any>

export default cache
