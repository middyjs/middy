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

  const start = () => before('lambda')
  const beforeHandler = () => before('handler')
  const afterHandler = () => before('handler')
  const end = () => after('lambda')

  return { start, before, beforeHandler, afterHandler, after, end }
}
