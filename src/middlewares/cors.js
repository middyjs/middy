const defaults = {
  origin: '*'
}

function addCorsHeaders (opts, handler, next) {
  const options = Object.assign({}, defaults, opts)

  if (handler.event.hasOwnProperty('httpMethod')) {
    handler.response = handler.response || {}
    handler.response.headers = handler.response.headers || {}
    if (!handler.response.headers.hasOwnProperty('Access-Control-Allow-Origin')) {
      handler.response.headers['Access-Control-Allow-Origin'] = options.origin
    }
  }

  next()
}

module.exports = (opts) => ({
  after: addCorsHeaders.bind(null, opts),
  onError: addCorsHeaders.bind(null, opts)
})
