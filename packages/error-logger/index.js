const defaults = {
  logger: console.error
}

const errorLoggerMiddleware = (opts = {}) => {
  let { logger } = { ...defaults, ...opts }
  if (typeof logger !== 'function') logger = null

  const errorLoggerMiddlewareOnError = async (handler) => logger(handler.error)
  return {
    onError: logger ? errorLoggerMiddlewareOnError : null
  }
}
module.exports = errorLoggerMiddleware
