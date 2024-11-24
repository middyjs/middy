const defaults = {
  plugins: [],
  enabled: true
}

const multiPlugin = (opts = {}) => {
  const { plugins, enabled } = { ...defaults, ...opts }
  if (!enabled) {
    return {}
  }

  const hooks = {
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
      hooks[id].push(plugin[id])
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

  hooks.afterMiddleware.reverse()
  hooks.afterHandler.reverse()
  hooks.requestEnd.reverse()

  const run = (id) => {
    for (let i = 0, l = hooks[id].length; i < l; i++) {
      hooks[id]()
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
