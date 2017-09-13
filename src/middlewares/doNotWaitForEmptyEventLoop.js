module.exports = () => ({
  after: (handler, next) => {
    handler.context.callbackWaitsForEmptyEventLoop = false
    next()
  }
})
