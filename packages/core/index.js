'use strict'

const assertIsFunction = (fn, message) => {
  if (typeof fn !== 'function') {
    throw new TypeError(message)
  }
}

function compose(middlewares) {
  return function runMiddlewares(request) {
    let currentIndex = 0

    async function dispatch(index) {
      if (index < currentIndex) {
        throw new Error('`next` was already called in this middleware')
      }

      if (index < middlewares.length) {
        const fn = middlewares[index]
        currentIndex = index

        function next() {
          return dispatch(index + 1)
        }

        return fn(request, next)
      }
    }

    return dispatch(0)
  }
}

function middy() {
  let errorHandler
  const middlewares = []

  return {
    get middlewares() {
      return [...middlewares]
    },

    use(middleware) {
      assertIsFunction(middleware, '`middleware` must be a function')
      middlewares.push(middleware)
      return this
    },

    error(cb) {
      assertIsFunction(cb, '`cb` must be a function')
      errorHandler = cb
      return this
    },

    lambda(handler) {
      assertIsFunction(handler, '`handler` must be a function')

      async function handlerMiddleware(request, next) {
        request.response = await handler(request.event, request.context)
        return next()
      }

      middlewares.push(handlerMiddleware)
      return this
    },

    handler() {
      const middlewaresFn = compose(middlewares)

      async function handleEvent(event, context = {}) {
        const request = {
          event,
          context,
          response: undefined,
          _internal: {}
        }

        try {
          await middlewaresFn(request)
          return request.response
        } catch (err) {
          if (errorHandler) {
            return errorHandler(err, request)
          }

          throw err
        }
      }

      return handleEvent
    }
  }
}

module.exports = middy
