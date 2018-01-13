const createError = require('http-errors')

module.exports = () => ({
  before: (handler, next) => {
    const headers = handler.event.headers || {}
    const contentType = headers['Content-Type'] || headers['content-type']

    if (contentType === 'application/json') {
      try {
        handler.event.body = JSON.parse(handler.event.body)
      } catch (err) {
        throw new createError.UnprocessableEntity('Content type defined as JSON but an invalid JSON was provided')
      }
    }

    next()
  }
})
