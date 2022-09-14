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
      if (route.path.test(path)) {
        return route.handler(event, context, abort)
      }
    }

    // Not Found
    throw createError(404, 'Route does not exist')
  }
}

const regexpDynamicWildcards = /\/\{proxy\+\}/g
// eslint-disable-next-line
const regexpDynamicParameters = /\/\{[^\/]+}/g
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']

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
    .replace(regexpDynamicWildcards, '/?.*')
    .replace(regexpDynamicParameters, '/.+')
  path = new RegExp(`^${path}$`)
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
