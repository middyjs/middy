
export default (opts = {}) => {
  const time = {}

  const defaults = {
    logger: console.log,
    before: (id) => {
      time[id] = process.hrtime()
    },
    after: (id) => {
      logger(id, process.hrtime(time[id])[1] / 1000000, 'ms')
    }
  }

  const { logger, before, after } = Object.assign({}, defaults, opts)

  return { before, after }
}
