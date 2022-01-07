const doNotWaitForEmptyEventLoopMiddleware = (opts = {}) => {
  const defaults = {
    runOnBefore: true,
    runOnAfter: false,
    runOnError: false
  }

  const options = { ...defaults, ...opts }

  const doNotWaitForEmptyEventLoop = async (request) => {
    request.context.callbackWaitsForEmptyEventLoop = false
  }

  return {
    before: options.runOnBefore ? doNotWaitForEmptyEventLoop : undefined,
    after: options.runOnAfter ? doNotWaitForEmptyEventLoop : undefined,
    onError: options.runOnError ? doNotWaitForEmptyEventLoop : undefined
  }
}
export default doNotWaitForEmptyEventLoopMiddleware
