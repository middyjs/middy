const defaults = {
  logger: console.log
}
module.exports = (opts = {}) => {
  const { logger } = Object.assign({}, defaults, opts)
  const store = {}

  const start = (id) => {
    store[id] = process.hrtime()
  }
  const stop = (id) => {
    logger(id, process.hrtime(store[id])[1] / 1000000, 'ms')
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

  return { beforePrefetch, requestStart, beforeMiddleware, afterMiddleware, beforeHandler, afterHandler, requestEnd }
}
