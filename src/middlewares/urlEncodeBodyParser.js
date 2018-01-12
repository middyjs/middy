const defaults = {
  extended: false
}

module.exports = (opts) => ({
  before: (handler, next) => {
    const options = Object.assign({}, defaults, opts)

    const parserFn = options.extended ? require('qs').parse : require('querystring').decode

    if (handler.event.headers && handler.event.headers['Content-Type'].indexOf('application/x-www-form-urlencoded') === 0) {
      handler.event.body = parserFn(handler.event.body)
    }
    next()
  }
})
