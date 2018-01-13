module.exports = (config) => {
  const defaults = {
    isWarmingUp: (event) => event.source === 'serverless-plugin-warmup',
    onWarmup: (event) => console.log('Exiting early via warmup Middleware')
  }

  const options = Object.assign({}, defaults, config)

  return ({
    before: (handler, next) => {
      if (options.isWarmingUp(handler.event)) {
        options.onWarmup(handler.event)
        return handler.callback(null, 'warmup')
      }

      next()
    }
  })
}
