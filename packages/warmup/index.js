module.exports = (config) => {
  const defaults = {
    isWarmingUp: (event) => event.source === 'serverless-plugin-warmup',
    onWarmup: (event) => console.log('Exiting early via warmup Middleware'),
    waitForEmptyEventLoop: null
  }

  const options = Object.assign({}, defaults, config)

  return ({
    before: (handler, next) => {
      if (options.isWarmingUp(handler.event)) {
        options.onWarmup(handler.event)
        if (options.waitForEmptyEventLoop !== null) {
          handler.context.callbackWaitsForEmptyEventLoop = Boolean(options.waitForEmptyEventLoop)
        }
        return handler.callback(null, 'warmup')
      }

      next()
    }
  })
}
