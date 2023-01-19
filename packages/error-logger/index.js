const defaults = {
  logger: (err) => {
    console.error(err.stack, { cause: err.cause })
  }
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
