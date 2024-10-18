const defaults = {
  plugins: [],
  enabled: true
}

const multiPlugin = (opts = {}) => {
  const { plugins, enabled } = { ...defaults, ...opts }
  if (!enabled) {
    return {}
  }

  const flows = {
    beforePrefetch: [],
    requestStart: [],
    beforeMiddleware: [],
    afterMiddleware: [], // reveresed
    beforeHandler: [],
    afterHandler: [], // reveresed
    requestEnd: [] // reveresed
  }

  const push = (id, plugin) => {
    if (plugin[id]) {
      flows[id].push(plugin[id])
    }
  }
  for (let i = 0, l = plugins.length; i < l; i++) {
    const plugin = plugins[i]
    push('beforePrefetch', plugin)
    push('requestStart', plugin)
    push('beforeMiddleware', plugin)
    push('afterMiddleware', plugin)
    push('beforeHandler', plugin)
    push('afterHandler', plugin)
    push('requestEnd', plugin)
  }

  flows.afterMiddleware.reverse()
  flows.afterHandler.reverse()
  flows.requestEnd.reverse()

  const run = (id) => {
    for (let i = 0, l = flows[id].length; i < l; i++) {
      flows[id]()
    }
  }
  return {
    beforePrefetch: () => run('beforePrefetch'),
    requestStart: () => run('requestStart'),
    beforeMiddleware: () => run('beforeMiddleware'),
    afterMiddleware: () => run('afterMiddleware'),
    beforeHandler: () => run('beforeHandler'),
    afterHandler: () => run('afterHandler'),
    requestEnd: () => run('requestEnd')
  }
}
export default multiPlugin
