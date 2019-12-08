const createError = require('http-errors')
const contentType = require('content-type')

module.exports = (opts) => ({
  before: (handler, next) => {
    opts = opts || {}
    if (handler.event.headers) {
      const contentTypeHeader = handler.event.headers['content-type'] || handler.event.headers['Content-Type']
      if (contentTypeHeader) {
        const { type } = contentType.parse(contentTypeHeader)
        if (type === 'application/json') {
          try {
            handler.event.body = JSON.parse(handler.event.body, opts.reviver)
          } catch (err) {
            throw new createError.UnprocessableEntity('Content type defined as JSON but an invalid JSON was provided')
          }
        }
      }
    }
    next()
  }
})
