const createError = require('http-errors')

const defaults = {
  extended: false
}

module.exports = (opts) => ({
  before: (handler, next) => {
    const options = Object.assign({}, defaults, opts)

    const parserFn = options.extended ? require('qs').parse : require('querystring').decode

    if (handler.event.headers && handler.event.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      try {
        handler.event.body = parserFn(handler.event.body)
      } catch (err) {
        throw new createError.UnprocessableEntity('Content type defined as urlencoded but it couldn\'t be decoded')
      }
    }
    next()
  }
})
