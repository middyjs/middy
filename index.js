const runMiddlewares = (middlewares, ctx, done) => {
  const stack = Array.from(middlewares)
  const runNext = () => {
    const nextMiddleware = stack.shift()

    if (nextMiddleware) {
      console.log('running', nextMiddleware, ctx)
      return nextMiddleware(ctx, runNext)
    }

    return done()
  }

  runNext()
}

const middy = (handler) => {
  const beforeMiddlewares = []
  const afterMiddlewares = []

  const instance = (event, context, callback) => {
    const ctx = {
      event,
      response : null,
      error: null
    }

    runMiddlewares(beforeMiddlewares, ctx, () => {
      handler.ctx = ctx
      handler(ctx.event, context, (err, response) => {
        ctx.error = err
        ctx.response = response
        runMiddlewares(afterMiddlewares, ctx, () => {
          return callback(ctx.error, ctx.response)
        })
      })
    })
  }

  instance.use = (middleware) => {
    if (middleware.before) {
      beforeMiddlewares.push(middleware.before)
    }

    if (middleware.after) {
      afterMiddlewares.unshift(middleware.after)
    }

    return instance
  }

  return instance
}

module.exports = middy
