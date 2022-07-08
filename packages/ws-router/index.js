import { createError } from '@middy/util'

const wsRouteHandler = (routes) => {
  const routesStatic = {}
  for (const route of routes) {
    const { routeKey, handler } = route

    // Static
    routesStatic[routeKey] = handler
  }

  return (event, context, abort) => {
    const { routeKey } = event.requestContext ?? {}
    if (!routeKey) {
      throw new Error('[ws-router] Unknown ws event format')
    }

    // Static
    const handler = routesStatic[routeKey]
    if (typeof handler !== 'undefined') {
      return handler(event, context, abort)
    }

    // Not Found
    throw createError(404, 'Route does not exist')
  }
}

export default wsRouteHandler
