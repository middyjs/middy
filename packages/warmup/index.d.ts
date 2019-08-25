import middy from '@middy/core'

interface IWarmupOptions {
  isWarmingUp?: (event: any) => boolean;
  onWarmup?: (event: any) => void;
  waitForEmptyEventLoop?: boolean;
}

declare function warmup(opts?: IWarmupOptions): middy.IMiddyMiddlewareObject;

export default warmup
