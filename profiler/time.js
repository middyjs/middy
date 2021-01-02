const defaults = {
  logger: console.log
}
export default (opts = {}) => {
  const { logger } = Object.assign({}, defaults, opts)
  const store = {}

  const before = (id) => {
    store[id] = process.hrtime()
  }
  const after = (id) => {
    logger(id, process.hrtime(store[id])[1] / 1000000, 'ms')
  }

  const start = () => before('lambda')
  const beforeHandler = () => before('handler')
  const afterHandler = () => after('handler')
  const end = () => after('lambda')

  return { start, before, beforeHandler, afterHandler, after, end }
}
