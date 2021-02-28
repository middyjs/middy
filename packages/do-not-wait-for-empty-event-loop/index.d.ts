import middy from '@middy/core'

interface IDoNotWaitForEmtpyEventLoopOptions {
  runOnBefore?: boolean
  runOnAfter?: boolean
  runOnError?: boolean
}

declare const doNotWaitForEmptyEventLoop: middy.Middleware<IDoNotWaitForEmtpyEventLoopOptions, any, any>

export default doNotWaitForEmptyEventLoop
