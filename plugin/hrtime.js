const defaults = {
  logger: console.log,
  enabled: true
}

const timePlugin = (opts = {}) => {
  const { logger, enabled } = { ...defaults, ...opts }
  if (!enabled) {
    return {}
  }

  let cold = true
  const store = {}

  const start = (id) => {
    store[id] = process.hrtime.bigint()
  }
  const stop = (id) => {
    if (!enabled) return
    logger(
      id,
      Number.parseInt((process.hrtime.bigint() - store[id]).toString()) /
        1_000_000,
      'ms'
    )
  }

  // Only run during cold start
  const beforePrefetch = () => start('prefetch')
  const requestStart = () => {
    if (cold) {
      cold = false
      stop('prefetch')
    }
    start('request')
  }
  const beforeMiddleware = start
  const afterMiddleware = stop
  const beforeHandler = () => start('handler')
  const afterHandler = () => stop('handler')
  const requestEnd = () => stop('request')

  return {
    beforePrefetch,
    requestStart,
    beforeMiddleware,
    afterMiddleware,
    beforeHandler,
    afterHandler,
    requestEnd
  }
}
export default timePlugin
