const createError = require('http-errors')
const contentType = require('content-type')

module.exports = () => ({
  before: (handler, next) => {
    if (handler.event.headers && handler.event.headers['Content-Type']) {
      const { type } = contentType.parse(handler.event.headers['Content-Type'])
      if (type === 'application/json') {
        try {
          handler.event.body = JSON.parse(handler.event.body)
        } catch (err) {
          throw new createError.UnprocessableEntity('Content type defined as JSON but an invalid JSON was provided')
        }
      }
    }
    next()
  }
})
