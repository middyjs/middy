import { createError } from '@middy/util'
const defaults = {
  routes: [],
  notFoundResponse: ({ routeKey }) => {
    const err = createError(404, 'Route does not exist', {
      cause: { package: '@middy/ws-router', data: { routeKey } }
    })
    throw err
  }
}
const wsRouteHandler = (opts = {}) => {
  if (Array.isArray(opts)) {
    opts = { routes: opts }
  }
  const { routes, notFoundResponse } = { ...defaults, ...opts }

  const routesStatic = {}
  for (const route of routes) {
    const { routeKey, handler } = route

    // Static
    routesStatic[routeKey] = handler
  }

  return (event, context, abort) => {
    const { routeKey } = event.requestContext ?? {}
    if (!routeKey) {
      throw new Error('Unknown WebSocket event format', {
        cause: { package: '@middy/ws-router' }
      })
    }

    // Static
    const handler = routesStatic[routeKey]
    if (typeof handler !== 'undefined') {
      return handler(event, context, abort)
    }

    // Not Found
    return notFoundResponse({ routeKey })
  }
}

export default wsRouteHandler
