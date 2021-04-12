const middy = (handler = () => {}, plugin) => {
  plugin?.beforePrefetch?.()
  const beforeMiddlewares = []
  const afterMiddlewares = []
  const onErrorMiddlewares = []

  const instance = (event = {}, context = {}) => {
    plugin?.requestStart?.()
    const request = {
      event,
      context,
      response: undefined,
      error: undefined,
      internal: {}
    }

    return runMiddy(
      request,
      handler,
      [...beforeMiddlewares],
      [...afterMiddlewares],
      [...onErrorMiddlewares],
      plugin
    )
  }

  instance.use = (middlewares) => {
    if (Array.isArray(middlewares)) {
      middlewares.forEach((middleware) => instance.applyMiddleware(middleware))
      return instance
    }
    return instance.applyMiddleware(middlewares)
  }

  instance.applyMiddleware = (middleware) => {
    const { before, after, onError } = middleware

    if (!before && !after && !onError) {
      throw new Error(
        'Middleware must an object containing at least one key among "before", "after", "onError"'
      )
    }

    if (before) instance.before(before)
    if (after) instance.after(after)
    if (onError) instance.onError(onError)

    return instance
  }

  // Inline Middlewares
  instance.before = (beforeMiddleware) => {
    beforeMiddlewares.push(beforeMiddleware)
    return instance
  }
  instance.after = (afterMiddleware) => {
    afterMiddlewares.unshift(afterMiddleware)
    return instance
  }
  instance.onError = (onErrorMiddleware) => {
    onErrorMiddlewares.push(onErrorMiddleware)
    return instance
  }

  instance.__middlewares = {
    before: beforeMiddlewares,
    after: afterMiddlewares,
    onError: onErrorMiddlewares
  }

  return instance
}

const runMiddy = async (
  request,
  handler,
  beforeMiddlewares,
  afterMiddlewares,
  onErrorMiddlewares,
  plugin
) => {
  try {
    await runMiddlewares(request, beforeMiddlewares, plugin)
    // Check if before stack doesn't need to exit early
    if (request.response === undefined) {
      plugin?.beforeHandler?.()
      request.response = await handler(request.event, request.context)
      plugin?.afterHandler?.()
      await runMiddlewares(request, afterMiddlewares, plugin)
    }
  } catch (e) {
    // Reset response changes made by after stack before error thrown
    request.response = undefined
    request.error = e
    try {
      await runMiddlewares(request, onErrorMiddlewares, plugin)
      // Catch if onError stack hasn't handled the error
      if (request.response === undefined) throw request.error
    } catch (e) {
      // Save error that wasn't handled
      e.originalError = request.error
      request.error = e
      throw request.error
    }
  } finally {
    await plugin?.requestEnd?.()
  }
  return request.response
}

const runMiddlewares = async (request, middlewares, plugin) => {
  if (!middlewares.length) return
  const nextMiddleware = middlewares.shift()
  plugin?.beforeMiddleware?.(nextMiddleware?.name)
  const res = await nextMiddleware?.(request)
  plugin?.afterMiddleware?.(nextMiddleware?.name)
  if (res !== undefined) {
    // short circuit chaining and respond early
    request.response = res
    return
  }
  return runMiddlewares(request, middlewares, plugin)
}

module.exports = middy
