module.exports = (config) => {
    // get isWarmingUp boolean from config object or use approach with serverless-warmup-plugin library
    const isWarmingUp = event => config.isWarmingUp || event.source === 'serverless-warmup-plugin'

    return ({
      before: (handler, next) => {
        if (isWarmingUp(event)) {
            console.log('Exiting early via warmUpMiddleware')
            return handler.callback(null, "warmup") //not provide any specific information here since it will not be shown
        }

        next()
      }
    })
  }