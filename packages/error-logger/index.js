const defaults = {
  logger: console.error
}

const errorLoggerMiddleware = (opts = {}) => {
  let { logger } = { ...defaults, ...opts }
  if (typeof logger !== 'function') logger = null

  const errorLoggerMiddlewareOnError = async (request) => {
    logger(request.error)
  }
  return {
    onError: logger ? errorLoggerMiddlewareOnError : null
  }
}
export default errorLoggerMiddleware
