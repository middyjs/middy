const middy = function (baseHandler = () => {}, plugin) {
  plugin?.beforePrefetch?.()
  const beforeMiddlewares = []
  const afterMiddlewares = []
  const onErrorMiddlewares = []

  // pattern to allow terser to compress
  const trueHandler = (event = {}, context = {}) => {
    plugin?.requestStart?.()
    const request = {
      event,
      context,
      response: undefined,
      error: undefined,
      internal: {}
    }

    return runRequest(
      request,
      [...beforeMiddlewares],
      baseHandler,
      [...afterMiddlewares],
      [...onErrorMiddlewares],
      plugin
    )
  }
  return Object.assign(trueHandler, {
    use (middlewares) {
      if (!Array.isArray(middlewares)) middlewares = [middlewares]
      for (const middleware of middlewares) {
        const { before, after, onError } = middleware

        if (!before && !after && !onError) {
          throw new Error(
            'Middleware must be an object containing at least one key among "before", "after", "onError"'
          )
        }

        if (before) this.before(before)
        if (after) this.after(after)
        if (onError) this.onError(onError)
      }
      return this
    },
    before (beforeMiddleware) {
      beforeMiddlewares.push(beforeMiddleware)
      return this
    },
    after (afterMiddleware) {
      afterMiddlewares.unshift(afterMiddleware)
      return this
    },
    onError (onErrorMiddleware) {
      // TODO reverse
      onErrorMiddlewares.push(onErrorMiddleware)
      return this
    }
    // handler (newHandler) {
    //   baseHandler = newHandler
    // }
  })

  /* const handler = (event = {}, context = {}) => {
    plugin?.requestStart?.()
    const request = {
      event,
      context,
      response: undefined,
      error: undefined,
      internal: {}
    }

    return runRequest(
      request,
      [...beforeMiddlewares],
      baseHandler,
      [...afterMiddlewares],
      [...onErrorMiddlewares],
      plugin
    )
  }
  return {
    handler,  // breaking change, can't have both, breaks terser
    use (middlewares) {
      if (Array.isArray(middlewares)) {
        for (const middleware of middlewares) {
          this.applyMiddleware(middleware)
        }
        return this
      }
      return this.applyMiddleware(middlewares)
    },
    applyMiddleware (middleware) {
      const { before, after, onError } = middleware

      if (!before && !after && !onError) {
        throw new Error(
          'Middleware must be an object containing at least one key among "before", "after", "onError"'
        )
      }

      if (before) this.before(before)
      if (after) this.after(after)
      if (onError) this.onError(onError)

      return this
    },
    before (beforeMiddleware) {
      beforeMiddlewares.push(beforeMiddleware)
      return this
    },
    after (afterMiddleware) {
      afterMiddlewares.unshift(afterMiddleware)
      return this
    },
    onError (onErrorMiddleware) {
      onErrorMiddlewares.push(onErrorMiddleware)
      return this
    }
  } */
}

const runRequest = async (
  request,
  beforeMiddlewares,
  handler,
  afterMiddlewares,
  onErrorMiddlewares,
  plugin
) => {
  try {
    await runMiddlewares(request, beforeMiddlewares, plugin)
    // Check if before stack hasn't exit early
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

// Called more than once, breaks terser :( https://github.com/terser/terser/issues/977
const runMiddlewares = async (request, middlewares, plugin) => {
  for (const nextMiddleware of middlewares) {
    plugin?.beforeMiddleware?.(nextMiddleware?.name)
    const res = await nextMiddleware?.(request)
    plugin?.afterMiddleware?.(nextMiddleware?.name)
    // short circuit chaining and respond early
    if (res !== undefined) {
      request.response = res
      return
    }
  }
}

module.exports = middy
