import middy from '@middy/core'

interface IWarmupOptions {
  isWarmingUp?: (event: any) => boolean;
  onWarmup?: (event: any) => void;
  waitForEmptyEventLoop?: boolean;
}

declare const warmup : middy.Middleware<IWarmupOptions, any, any>

export default warmup
