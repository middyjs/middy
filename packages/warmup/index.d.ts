import middy from '../core'

interface IWarmupOptions {
  isWarmingUp?: (event: any) => boolean;
  onWarmup?: (event: any) => void;
}

declare function warmup(opts?: IWarmupOptions): middy.IMiddyMiddlewareObject;

export default warmup
