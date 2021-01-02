import memwatch from '@airbnb/node-memwatch'

const defaults = {
  logger: console.log
}

export default (opts = {}) => {
  const { logger } = Object.assign({}, defaults, opts)
  const store = {}

  const before = (id) => {
    store[id] = new memwatch.HeapDiff()
  }
  const after = (id) => {
    logger(id, store[id].end())
  }

  const start = () => before('total')
  const initStart = () => before('init')
  const initEnd = () => after('init')
  const beforeHandler = () => before('handler')
  const afterHandler = () => before('handler')
  const end = () => after('total')

  return { start, initStart, initEnd, before, beforeHandler, afterHandler, after, end }
}
