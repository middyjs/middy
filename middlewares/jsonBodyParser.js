module.exports = () => ({
  before: (ctx, next) => {
    if (ctx.event.headers['Content-Type'] === 'application/json') {
      ctx.event.body = JSON.parse(ctx.event.body)
    }
    next()
  }
})
