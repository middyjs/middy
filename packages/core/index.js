/* global awslambda */
import { pipeline } from 'node:stream/promises'
import { setTimeout } from 'node:timers/promises'

const defaultLambdaHandler = () => {}
const defaultPlugin = {
  timeoutEarlyInMillis: 5,
  timeoutEarlyResponse: () => {
    throw new Error('Timeout')
  },
  streamifyResponse: false
}

const middy = (lambdaHandler = defaultLambdaHandler, plugin = {}) => {
  // Allow base handler to be set using .handler()
  if (typeof lambdaHandler !== 'function') {
    plugin = lambdaHandler
    lambdaHandler = defaultLambdaHandler
  }
  plugin = { ...defaultPlugin, ...plugin }
  plugin.timeoutEarly = plugin.timeoutEarlyInMillis > 0

  plugin.beforePrefetch?.()
  const beforeMiddlewares = []
  const afterMiddlewares = []
  const onErrorMiddlewares = []

  // streamifyResponse
  const middyHandler = (event = {}, context = {}) => {
    plugin.requestStart?.()
    const request = {
      event,
      context,
      response: undefined,
      error: undefined,
      internal: plugin.internal ?? {}
    }

    return runRequest(
      request,
      [...beforeMiddlewares],
      lambdaHandler,
      [...afterMiddlewares],
      [...onErrorMiddlewares],
      plugin
    )
  }
  const middy = plugin.streamifyResponse
    ? awslambda.streamifyResponse(async (event, responseStream, context) => {
      const response = await middyHandler(event, context)
      const body = response.body
      delete response.body

      responseStream = awslambda.HttpResponseStream.from(
        responseStream,
        response
      )

      await pipeline(body, responseStream)
    })
    : middyHandler

  middy.use = (middlewares) => {
    if (!Array.isArray(middlewares)) {
      middlewares = [middlewares]
    }
    for (const middleware of middlewares) {
      const { before, after, onError } = middleware

      if (!before && !after && !onError) {
        throw new Error(
          'Middleware must be an object containing at least one key among "before", "after", "onError"'
        )
      }

      if (before) middy.before(before)
      if (after) middy.after(after)
      if (onError) middy.onError(onError)
    }
    return middy
  }

  // Inline Middlewares
  middy.before = (beforeMiddleware) => {
    beforeMiddlewares.push(beforeMiddleware)
    return middy
  }
  middy.after = (afterMiddleware) => {
    afterMiddlewares.unshift(afterMiddleware)
    return middy
  }
  middy.onError = (onErrorMiddleware) => {
    onErrorMiddlewares.unshift(onErrorMiddleware)
    return middy
  }
  middy.handler = (replaceLambdaHandler) => {
    lambdaHandler = replaceLambdaHandler
    return middy
  }

  return middy
}

const runRequest = async (
  request,
  beforeMiddlewares,
  lambdaHandler,
  afterMiddlewares,
  onErrorMiddlewares,
  plugin
) => {
  let timeoutAbort
  const timeoutEarly =
    plugin.timeoutEarly && request.context.getRemainingTimeInMillis // disable when AWS context missing (tests, containers)
  try {
    await runMiddlewares(request, beforeMiddlewares, plugin)
    // Check if before stack hasn't exit early
    if (typeof request.response === 'undefined') {
      plugin.beforeHandler?.()

      const handlerAbort = new AbortController()

      if (timeoutEarly) timeoutAbort = new AbortController()
      request.response = await Promise.race([
        lambdaHandler(request.event, request.context, {
          signal: handlerAbort.signal
        }),
        timeoutEarly
          ? setTimeout(
            request.context.getRemainingTimeInMillis() -
                plugin.timeoutEarlyInMillis,
            undefined,
            { signal: timeoutAbort.signal }
          ).then(() => {
            handlerAbort.abort()
            return plugin.timeoutEarlyResponse()
          })
          : Promise.race([])
      ])
      timeoutAbort?.abort() // lambdaHandler may not be a promise

      plugin.afterHandler?.()
      await runMiddlewares(request, afterMiddlewares, plugin)
    }
  } catch (e) {
    timeoutAbort?.abort() // timeout should be aborted on errors

    // Reset response changes made by after stack before error thrown
    request.response = undefined
    request.error = e
    try {
      await runMiddlewares(request, onErrorMiddlewares, plugin)
    } catch (e) {
      // Save error that wasn't handled
      e.originalError = request.error
      request.error = e

      throw request.error
    }
    // Catch if onError stack hasn't handled the error
    if (typeof request.response === 'undefined') throw request.error
  } finally {
    await plugin.requestEnd?.(request)
  }

  return request.response
}

const runMiddlewares = async (request, middlewares, plugin) => {
  for (const nextMiddleware of middlewares) {
    plugin.beforeMiddleware?.(nextMiddleware.name)
    const res = await nextMiddleware(request)
    plugin.afterMiddleware?.(nextMiddleware.name)
    // short circuit chaining and respond early
    if (typeof res !== 'undefined') {
      request.response = res
      return
    }
  }
}

export default middy
