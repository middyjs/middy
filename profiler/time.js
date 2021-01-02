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

  const start = () => before('total')
  const initStart = () => before('init')
  const initEnd = () => after('init')
  const beforeHandler = () => before('handler')
  const afterHandler = () => after('handler')
  const end = () => after('total')

  return { start, initStart, initEnd, before, beforeHandler, afterHandler, after, end }
}
