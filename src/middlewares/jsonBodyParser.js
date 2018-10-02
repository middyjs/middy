const createError = require('http-errors')
const contentType = require('content-type')

module.exports = () => ({
  before: (handler, next) => {
    const { headers } = handler.event
    // normalize header
    const headerContentType = headers['Content-Type'] || headers['content-type']
    if (headers && headerContentType) {
      const { type } = contentType.parse(headerContentType)
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
