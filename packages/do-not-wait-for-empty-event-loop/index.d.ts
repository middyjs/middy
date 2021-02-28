import middy from '@middy/core'

interface Options {
  runOnBefore?: boolean
  runOnAfter?: boolean
  runOnError?: boolean
}

declare function doNotWaitForEmptyEventLoop (options?: Options): middy.MiddlewareObj

export default doNotWaitForEmptyEventLoop
