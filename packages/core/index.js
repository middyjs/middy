const isPromise = require('./isPromise')
const once = require('once')

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
 * @param {middlewareNextFunction} next - the callback to invoke to pass the control to the next middleware
 * @return {void|Promise} - A middleware can return a Promise instead of using the `next` function as a callback.
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

const runMiddlewares = (middlewares, request, done) => {
  const stack = Array.from(middlewares)
  const runNext = (err) => {
    try {
      if (err) {
        return done(err)
      }

      const nextMiddleware = stack.shift()

      if (nextMiddleware) {
        const retVal = nextMiddleware(request, runNext)

        if (retVal) {
          if (!isPromise(retVal)) {
            throw new Error('Unexpected return value in middleware')
          }

          retVal
            .then(runNext)
            .catch(done)
        }

        return
      }

      return done()
    } catch (err) {
      return done(err)
    }
  }

  runNext()
}

const runErrorMiddlewares = (middlewares, request, done) => {
  const stack = Array.from(middlewares)
  request.__handledError = false
  const runNext = (err) => {
    try {
      if (!err) {
        request.__handledError = true
      }

      const nextMiddleware = stack.shift()

      if (nextMiddleware) {
        const retVal = nextMiddleware(request, runNext)

        if (retVal) {
          if (!isPromise(retVal)) {
            const invalidMiddlewareReturnError = new Error('Unexpected return value in onError middleware')
            // embed original error to avoid swallowing the real exception
            invalidMiddlewareReturnError.originalError = err
            throw invalidMiddlewareReturnError
          }

          retVal
            .then(runNext)
            .catch(done)
        }

        return
      }

      return done(request.__handledError ? null : err)
    } catch (err) {
      return done(err)
    }
  }

  runNext(request.error)
}

/**
 * Middy factory function. Use it to wrap your existing handler to enable middlewares on it.
 * @param  {function} handler - your original AWS Lambda function
 * @return {middy} - a `middy` instance
 */
const middy = (handler) => {
  const beforeMiddlewares = []
  const afterMiddlewares = []
  const errorMiddlewares = []

  const instance = (event, context, callback) => {
    const request = {}
    request.event = event
    request.context = context
    request.callback = callback
    request.response = null
    request.error = null

    const middyPromise = new Promise((resolve, reject) => {
      const terminate = (err) => {
        if (err) {
          return callback ? callback(err) : reject(err)
        }

        return callback ? callback(null, request.response) : resolve(request.response)
      }

      const errorHandler = err => {
        request.error = err
        return runErrorMiddlewares(errorMiddlewares, request, terminate)
      }

      runMiddlewares(beforeMiddlewares, request, (err) => {
        if (err) return errorHandler(err)

        const onHandlerError = once((err) => {
          request.response = null
          errorHandler(err)
        })

        const onHandlerSuccess = once((response) => {
          request.response = response
          runMiddlewares(afterMiddlewares, request, (err) => {
            if (err) return errorHandler(err)

            terminate()
          })
        })

        const handlerReturnValue = handler.call(request, request.event, request.context, (err, response) => {
          if (err) return onHandlerError(err)
          onHandlerSuccess(response)
        })

        // support for async/await promise return in handler
        if (handlerReturnValue) {
          if (!isPromise(handlerReturnValue)) {
            throw new Error('Unexpected return value in handler')
          }

          handlerReturnValue
            .then(onHandlerSuccess)
            .catch(onHandlerError)
        }
      })
    })
    if (!request.callback) return middyPromise
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

    if (before) {
      instance.before(before)
    }

    if (after) {
      instance.after(after)
    }

    if (onError) {
      instance.onError(onError)
    }

    return instance
  }

  instance.before = (beforeMiddleware) => {
    beforeMiddlewares.push(beforeMiddleware)

    return instance
  }

  instance.after = (afterMiddleware) => {
    afterMiddlewares.unshift(afterMiddleware)

    return instance
  }

  instance.onError = (errorMiddleware) => {
    errorMiddlewares.push(errorMiddleware)

    return instance
  }

  instance.__middlewares = {
    before: beforeMiddlewares,
    after: afterMiddlewares,
    onError: errorMiddlewares
  }

  return instance
}

module.exports = middy
