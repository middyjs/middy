import { createError } from '@middy/util'
const defaults = {
  routes: [],
  notFoundResponse: ({ requestType }) => {
    const err = createError(404, 'Route does not exist', {
      cause: {
        package: '@middy/cloudformation-router',
        data: { requestType }
      }
    })
    throw err
  }
}
const cloudformationCustomResourceRouteHandler = (opts = {}) => {
  if (Array.isArray(opts)) {
    opts = { routes: opts }
  }
  const { routes, notFoundResponse } = { ...defaults, ...opts }

  const routesStatic = {}
  for (const route of routes) {
    const { requestType, handler } = route

    // Static
    routesStatic[requestType] = handler
  }

  return (event, context, abort) => {
    const { RequestType: requestType } = event
    if (!requestType) {
      throw new Error('Unknown CloudFormation event format', {
        cause: { package: '@middy/cloudformation-router' }
      })
    }

    // Static
    const handler = routesStatic[requestType]
    if (typeof handler !== 'undefined') {
      const response = handler(event, context, abort)
      response.Status ??= 'SUCCESS'
      response.RequestId ??= event.RequestId
      response.LogicalResourceId ??= event.LogicalResourceId
      response.StackId ??= event.StackId
      return response
    }

    // Not Found
    return notFoundResponse({ requestType })
  }
}

export default cloudformationCustomResourceRouteHandler
