export default (opts = {}) => {
  const defaults = {
    runOnBefore: true,
    runOnAfter: false,
    runOnError: false
  }

  const options = Object.assign({}, defaults, opts)

  const doNotWaitForEmptyEventLoop = async (handler) => {
    handler.context.callbackWaitsForEmptyEventLoop = false
  }

  return ({
    before: options.runOnBefore ? doNotWaitForEmptyEventLoop : undefined,
    after: options.runOnAfter ? doNotWaitForEmptyEventLoop : undefined,
    onError: options.runOnError ? doNotWaitForEmptyEventLoop : undefined
  })
}
