import middy from '@middy/core'

interface IDoNotWaitForEmtpyEventLoopOptions {
  runOnBefore?: boolean;
  runOnAfter?: boolean;
  runOnError?: boolean;
}

declare function doNotWaitForEmptyEventLoop(opts?: IDoNotWaitForEmtpyEventLoopOptions): middy.IMiddyMiddlewareObject;

export default doNotWaitForEmptyEventLoop
