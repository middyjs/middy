module.exports = (config) => {
  const defaults = {
    isWarmingUp: (event) => event.source === 'serverless-warmup-plugin'
  }

  const options = Object.assign({}, defaults, config)

  if (!(options.isWarmingUp instanceof Function)) {
    throw Error('config.isWarmingUp should be a function')
  }

  return ({
    before: (handler, next) => {
      if (options.isWarmingUp(handler.event)) {
        console.log('Exiting early via warmUpMiddleware')
        return handler.callback(null, 'warmup')// not provide any specific information here since it will not be shown
      }

      next()
    }
  })
}
