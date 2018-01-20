module.exports = (opts) => {
  const defaults = {
    runOnBefore: true,
    runOnAfter: false,
    runOnError: false
  }

  const options = Object.assign({}, defaults, opts)

  const disableEmptyEventLoopWait = (handler, next) => {
    handler.context.callbackWaitsForEmptyEventLoop = false
    next()
  }

  return ({
    before: options.runOnBefore ? disableEmptyEventLoopWait : undefined,
    after: options.runOnAfter ? disableEmptyEventLoopWait : undefined,
    onError: options.runOnError ? disableEmptyEventLoopWait : undefined
  })
}
