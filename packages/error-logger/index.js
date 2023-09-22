const defaults = {
  logger: ({ error }) => console.error(error)
}

const errorLoggerMiddleware = (opts = {}) => {
  let { logger } = { ...defaults, ...opts }
  if (typeof logger !== 'function') logger = null

  const errorLoggerMiddlewareOnError = async (request) => {
    logger(request)
  }
  return {
    onError: logger ? errorLoggerMiddlewareOnError : null
  }
}
export default errorLoggerMiddleware
