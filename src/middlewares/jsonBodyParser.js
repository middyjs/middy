const createError = require('http-errors')
const contentTypeLib = require('content-type')

module.exports = () => ({
  before: (handler, next) => {
    const { headers } = handler.event
    if (!headers) {
      return next()
    }
    const contentType = headers['Content-Type'] || headers['content-type']
    if (contentType) {
      const { type } = contentTypeLib.parse(contentType)
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
