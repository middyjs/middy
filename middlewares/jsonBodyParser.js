const createError = require('http-errors')

module.exports = () => ({
  before: (ctx, next) => {
    if (ctx.event.headers['Content-Type'] === 'application/json') {
      try {
        ctx.event.body = JSON.parse(ctx.event.body)
      } catch (err) {
        throw new createError.UnprocessableEntity('Content type defined as JSON but an invalid JSON was provided')
      }
    }
    next()
  }
})
