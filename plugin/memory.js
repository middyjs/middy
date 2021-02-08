const memwatch = require('@airbnb/node-memwatch')

const defaults = {
  logger: console.log
}

module.exports = (opts = {}) => {
  const { logger } = { ...defaults, ...opts }
  const store = {}

  const start = (id) => {
    store[id] = new memwatch.HeapDiff()
  }
  const stop = (id) => {
    logger(id, store[id].end())
  }

  const beforePrefetch = () => start('total')
  const requestStart = () => {
    store.init = store.total
    stop('init')
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
