
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
  profiler?.before(middlewares.length)
  await nextMiddleware?.(request)
  profiler?.after(middlewares.length)
  return runMiddlewares(stack, request, profiler)
}

/**
 * Middy factory function. Use it to wrap your existing handler to enable middlewares on it.
 * @param  {function} handler - your original AWS Lambda function
 * @param  {middlewareObject} profiler - wraps around each middleware and handler to profile performance
 * @return {middy} - a `middy` instance
 */
const middy = (handler, profiler = null) => {
  const beforeMiddlewares = []
  const afterMiddlewares = []
  const errorMiddlewares = []

  const instance = (event, context, callback) => {
    const request = {
      event,
      context,
      callback,
      response: null,
      error: null
    }

    console.log('beforeMiddlewares',beforeMiddlewares)
    console.log('afterMiddlewares',afterMiddlewares)
    console.log('errorMiddlewares',errorMiddlewares)

    const catchError = async (err) => {
      console.log('catchError')
      request.response = null
      request.error = err
      await runMiddlewares(errorMiddlewares, request, profiler)
      if (request.response) return callback(null, request.response)
      return callback(err)
    }

    const middyPromise = async () => {
      try {
        await runMiddlewares(beforeMiddlewares, request, profiler)
      } catch (err) {
        return catchError(err)
      }
      try {
        profiler?.before('handler')
        request.response = await handler(request.event, request.context)
        profiler?.after('handler')
        await runMiddlewares(beforeMiddlewares, request, profiler)
        return callback(null, request.response)
      } catch (err) {
        return catchError(err)
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

    beforeMiddlewares.push(before)
    afterMiddlewares.unshift(after)
    errorMiddlewares.unshift(onError)

    return instance
  }

  instance.__middlewares = {
    before: beforeMiddlewares,
    after: afterMiddlewares,
    onError: errorMiddlewares
  }

  return instance
}

export default middy
