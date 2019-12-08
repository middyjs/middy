module.exports = () => ({
  before: (handler, next) => {
    if (handler.event.pathParameters) {
      for (let key in handler.event.pathParameters) {
        try {
          handler.event.pathParameters[key] = decodeURIComponent(handler.event.pathParameters[key])
        } catch (e) {
          console.error(e)
        }
      }
    }

    next()
  }
})
