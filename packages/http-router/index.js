import { createError } from '@middy/util'

const httpRouteHandler = (routes) => {
  const routesStatic = {}
  const routesDynamic = {}
  const enumMethods = methods.concat('ANY')
  for (const route of routes) {
    let { method, path, handler } = route

    // Prevents `routesType[method][path] = handler` from flagging: This assignment may alter Object.prototype if a malicious '__proto__' string is injected from library input.
    if (!enumMethods.includes(method)) {
      throw new Error('[http-router] Method not allowed')
    }

    // remove trailing slash, but not if it's the first one
    if (path.endsWith('/') && path !== '/') {
      path = path.substr(0, path.length - 1)
    }

    // Static
    if (path.indexOf('{') < 0) {
      attachStaticRoute(method, path, handler, routesStatic)
      continue
    }

    // Dynamic
    attachDynamicRoute(method, path, handler, routesDynamic)
  }

  return (event, context, abort) => {
    const { method, path } = getVersionRoute[event.version ?? '1.0']?.(event)
    if (!method) {
      throw new Error('[http-router] Unknown http event format')
    }

    // Static
    const handler = routesStatic[method]?.[path]
    if (typeof handler !== 'undefined') {
      return handler(event, context, abort)
    }

    // Dynamic
    for (const route of routesDynamic[method] ?? []) {
      const match = path.match(route.path)
      if (match) {
        event.pathParameters = {
          ...match.groups,
          ...event.pathParameters
        }
        return route.handler(event, context, abort)
      }
    }

    // Not Found
    throw createError(404, 'Route does not exist')
  }
}

const regexpDynamicWildcards = /\/\{(proxy)\+\}$/
const regexpDynamicParameters = /\/\{([^/]+)\}/g

export const Method = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Patch: 'PATCH',
  Delete: 'DELETE',
  Options: 'OPTIONS',
  Head: 'HEAD',
  Any: 'ANY'
}
const methods = Object.values(Method).filter((method) => method !== 'ANY')

const attachStaticRoute = (method, path, handler, routesType) => {
  if (method === 'ANY') {
    for (const method of methods) {
      attachStaticRoute(method, path, handler, routesType)
    }
    return
  }
  if (!routesType[method]) {
    routesType[method] = {}
  }
  routesType[method][path] = handler
  routesType[method][path + '/'] = handler // Optional `/`
}

const attachDynamicRoute = (method, path, handler, routesType) => {
  if (method === 'ANY') {
    for (const method of methods) {
      attachDynamicRoute(method, path, handler, routesType)
    }
    return
  }
  if (!routesType[method]) {
    routesType[method] = []
  }
  path = path
    .replace(regexpDynamicWildcards, '/?(?<$1>.*)')
    .replace(regexpDynamicParameters, '/(?<$1>[^/]+)')
  path = new RegExp(`^${path}/?$`) // Adds in optional `/`
  routesType[method].push({ path, handler })
}

const getVersionRoute = {
  '1.0': (event) => ({
    method: event.httpMethod,
    path: event.path
  }),
  '2.0': (event) => ({
    method: event.requestContext.http.method,
    path: event.requestContext.http.path
  })
}

export default httpRouteHandler
