export default (opts = {}) => {
  const defaults = {
    runOnBefore: true,
    runOnAfter: false,
    runOnError: false
  }

  const options = Object.assign({}, defaults, opts)

  const disableEmptyEventLoopWait = async (handler) => {
    handler.context.callbackWaitsForEmptyEventLoop = false
  }

  return ({
    before: options.runOnBefore ? disableEmptyEventLoopWait : undefined,
    after: options.runOnAfter ? disableEmptyEventLoopWait : undefined,
    onError: options.runOnError ? disableEmptyEventLoopWait : undefined
  })
}
