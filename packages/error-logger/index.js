const defaults = {
  logger: console.error
}

export default (opts = {}) => {
  let { logger } = Object.assign({}, defaults, opts)
  if (typeof logger !== 'function') logger = null

  const errorLoggerMiddlewareOnError = async (handler) => logger(handler.error)
  return {
    onError: logger ? errorLoggerMiddlewareOnError : null
  }
}
