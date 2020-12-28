export default (opts = {}) => {
  const defaults = {
    logger: console.error
  }

  let {logger} = Object.assign({}, defaults, opts)
  if (typeof logger !== 'function') logger = ()=>{}
  return ({
    onError: async (handler) => logger(handler.error)
  })
}
