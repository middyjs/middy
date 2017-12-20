const defaults = {
  extended: false
}

module.exports = (opts) => ({
  before: (handler, next) => {
    const options = Object.assign({}, defaults, opts)

    const parserFn = options.extended ? require('qs').parse : require('querystring').decode

    if (handler.event.headers && handler.event.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      handler.event.body = parserFn(handler.event.body)
    }
    next()
  }
})
