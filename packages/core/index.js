
/**
 * @typedef middy
 * @type function
 * @param {Object} event - the AWS Lambda event from the original handler
 * @param {Object} context - the AWS Lambda context from the original handler
 * @param {function} callback - the AWS Lambda callback from the original handler
 * @property {useFunction} use - attach one or more new middlewares
 * @property {applyMiddlewareFunction} applyMiddleware - attach a new middleware
 * @property {middlewareAttachFunction} before - attach a new *before-only* middleware
 * @property {middlewareAttachFunction} after - attach a new *after-only* middleware
 * @property {middlewareAttachFunction} onError - attach a new *error-handler-only* middleware
 * @property {Object} __middlewares - contains the list of all the attached
 *   middlewares organised by type (`before`, `after`, `onError`). To be used only
 *   for testing and debugging purposes
 */

/**
 * @typedef useFunction
 * @type {function}
 * @param {middlewareObject|middlewareObject[]} - the middleware object or array of middleware objects to attach
 * @return {middy}
 */

/**
 * @typedef applyMiddlewareFunction
 * @type {function}
 * @param {middlewareObject} - the middleware object to attach
 * @return {middy}
 */

/**
 * @typedef middlewareAttachFunction
 * @type {function}
 * @param {middlewareFunction} - the middleware function to attach
 * @return {middy}
 */

/**
 * @typedef middlewareNextFunction
 * @type {function}
 * @param {error} error - An optional error object to pass in case an error occurred
 */

/**
 * @typedef middlewareFunction
 * @type {function}
 * @param {function} handler - the original handler function.
 *   It will expose properties `event`, `context`, `response`, `error` and `callback` that can
 *   be used to interact with the middleware lifecycle
 * @return {void|Promise} - A middleware can return a Promise.
 *                          In this case middy will wait for the promise to resolve (or reject) and it will automatically
 *                          propagate the result to the next middleware.
 */

/**
 * @typedef middlewareObject
 * @type Object
 * @property {middlewareFunction} before - the middleware function to attach as *before* middleware
 * @property {middlewareFunction} after - the middleware function to attach as *after* middleware
 * @property {middlewareFunction} onError - the middleware function to attach as *error* middleware
 */

const runMiddlewares = async (middlewares, request, profiler = null) => {
  const stack = Array.from(middlewares)
  if (!stack.length) return
  const nextMiddleware = stack.shift()
  profiler?.before(middlewares.length + '-' + nextMiddleware?.name)
  await nextMiddleware?.(request)
  profiler?.after(middlewares.length + '-' + nextMiddleware?.name)
  return runMiddlewares(stack, request, profiler)
}

const runErrorMiddlewares = async (middlewares, request, profiler = null) => {
  const stack = Array.from(middlewares)
  if (!stack.length || request.response) return
  const nextMiddleware = stack.shift()
  profiler?.before(middlewares.length + '-' + nextMiddleware?.name)
  await nextMiddleware?.(request)
  profiler?.after(middlewares.length + '-' + nextMiddleware?.name)
  return runErrorMiddlewares(stack, request, profiler)
}


/**
 * Middy factory function. Use it to wrap your existing handler to enable middlewares on it.
 * @param  {function} handler - your original AWS Lambda function
 * @param  {middlewareObject} profiler - wraps around each middleware and handler to profile performance
 * @return {middy} - a `middy` instance
 */
const middy = (handler, profiler) => {
  const beforeMiddlewares = []
  const afterMiddlewares = []
  const onErrorMiddlewares = []

  const instance = (event, context, callback) => {
    const request = {
      event,
      context,
      callback,
      response: null,
      error: null,
      internal: {}
    }

    const middyPromise = async () => {
      try {
        await runMiddlewares(beforeMiddlewares, request, profiler)
        profiler?.before('0-handler')
        request.response = await handler(request.event, request.context)
        profiler?.after('0-handler')
        await runMiddlewares(afterMiddlewares, request, profiler)
        return callback(null, request.response)
      } catch (err) {
        request.response = null
        request.error = err
        await runErrorMiddlewares(onErrorMiddlewares, request, profiler)
        if (request.response) return callback(null, request.response)
        return callback(err)
      }
    }
    return middyPromise()
  }

  instance.use = (middlewares) => {
    if (Array.isArray(middlewares)) {
      middlewares.forEach(middleware => instance.applyMiddleware(middleware))
      return instance
    } else if (typeof middlewares === 'object') {
      return instance.applyMiddleware(middlewares)
    } else {
      throw new Error('Middy.use() accepts an object or an array of objects')
    }
  }

  instance.applyMiddleware = (middleware) => {
    if (typeof middleware !== 'object') {
      throw new Error('Middleware must be an object')
    }

    const { before, after, onError } = middleware

    if (!before && !after && !onError) {
      throw new Error('Middleware must contain at least one key among "before", "after", "onError"')
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

export default middy
