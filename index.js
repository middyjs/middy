const runMiddlewares = (middlewares, instance, done) => {
  const stack = Array.from(middlewares)
  const runNext = (err) => {
    try {
      if (err) {
        return done(err)
      }

      const nextMiddleware = stack.shift()

      if (nextMiddleware) {
        return nextMiddleware(instance, runNext)
      }

      return done()
    } catch (err) {
      return done(err)
    }
  }

  runNext()
}

const runErrorMiddlewares = (middlewares, instance, done) => {
  const stack = Array.from(middlewares)
  const runNext = (err) => {
    try {
      if (!err) {
        return done()
      }

      const nextMiddleware = stack.shift()

      if (nextMiddleware) {
        return nextMiddleware(instance, runNext)
      }

      return done(err)
    } catch (err) {
      return done(err)
    }
  }

  runNext(instance.error)
}

const middy = (handler) => {
  const beforeMiddlewares = []
  const afterMiddlewares = []
  const errorMiddlewares = []

  const instance = (event, context, callback) => {
    instance.event = event
    instance.context = context
    instance.response = null
    instance.error = null

    const terminate = (err) => {
      if (err) {
        return callback(err)
      }

      return callback(null, instance.response)
    }

    runMiddlewares(beforeMiddlewares, instance, (err) => {
      if (err) {
        instance.error = err
        return runErrorMiddlewares(errorMiddlewares, instance, terminate)
      }

      handler.call(instance, instance.event, context, (err, response) => {
        instance.response = response

        if (err) {
          instance.error = err
          return runErrorMiddlewares(errorMiddlewares, instance, terminate)
        }

        runMiddlewares(afterMiddlewares, instance, (err) => {
          if (err) {
            instance.error = err
            return runErrorMiddlewares(errorMiddlewares, instance, terminate)
          }

          return terminate()
        })
      })
    })
  }

  instance.use = (middleware) => {
    if (typeof middleware !== 'object') {
      throw new Error('Middleware must be an object')
    }

    if (!middleware.before && !middleware.after && !middleware.onError) {
      throw new Error('Middleware must contain at least one key among "before", "after", "onError"')
    }

    if (middleware.before) {
      instance.before(middleware.before)
    }

    if (middleware.after) {
      instance.after(middleware.after)
    }

    if (middleware.onError) {
      instance.onError(middleware.onError)
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
