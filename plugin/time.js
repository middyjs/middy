const defaults = {
  logger: console.log,
  enabled: true
}

const timePlugin = (opts = {}) => {
  const { logger, enabled } = { ...defaults, ...opts }
  const store = {}

  const start = (id) => {
    store[id] = process.hrtime.bigint()
  }
  const stop = (id) => {
    if (!enabled) return
    logger(id, Number.parseInt((process.hrtime.bigint() - store[id]).toString()) / 1000000, 'ms')
  }

  // Only run during cold start
  const beforePrefetch = () => start('total')
  const requestStart = () => {
    if (!store.init) {
      store.init = store.total
      stop('init')
    } else {
      start('total')
    }
  }
  const beforeMiddleware = start
  const afterMiddleware = stop
  const beforeHandler = () => start('handler')
  const afterHandler = () => stop('handler')
  const requestEnd = () => stop('total')

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
module.exports = timePlugin
