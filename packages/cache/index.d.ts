import middy from '@middy/core'

interface ICacheOptions {
  calculateCacheId?: (event: any) => Promise<string>;
  getValue?: (key: string) => Promise<any>;
  setValue?: (key: string) => Promise<void>;
}

declare function cache(opts?: ICacheOptions): middy.IMiddyMiddlewareObject;

export default cache
