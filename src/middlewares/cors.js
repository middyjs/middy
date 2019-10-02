const defaults = {
  origin: '*',
  origins: [],
  headers: null,
  credentials: false
}

const getOrigin = (options, handler) => {
  handler.event.headers = handler.event.headers || {}
  if (options.origins && options.origins.length > 0) {
    if (handler.event.headers.hasOwnProperty('Origin') && options.origins.includes(handler.event.headers.Origin)) {
      return handler.event.headers.Origin
    } else {
      return options.origins[0]
    }
  } else {
    if (handler.event.headers.hasOwnProperty('Origin') && options.credentials && options.origin === '*') {
      return handler.event.headers.Origin
    }
    return options.origin
  }
}

const addCorsHeaders = (opts, handler, next) => {
  const options = Object.assign({}, defaults, opts)

  if (handler.event.hasOwnProperty('httpMethod')) {
    handler.response = handler.response || {}
    handler.response.headers = handler.response.headers || {}

    // Check if already setup Access-Control-Allow-Headers
    if (options.headers !== null && !handler.response.headers.hasOwnProperty('Access-Control-Allow-Headers')) {
      handler.response.headers['Access-Control-Allow-Headers'] = options.headers
    }

    // Check if already setup the header Access-Control-Allow-Credentials
    if (handler.response.headers.hasOwnProperty('Access-Control-Allow-Credentials')) {
      options.credentials = JSON.parse(handler.response.headers['Access-Control-Allow-Credentials'])
    }

    if (options.credentials) {
      handler.response.headers['Access-Control-Allow-Credentials'] = String(options.credentials)
    }
    // Check if already setup the header Access-Control-Allow-Origin
    if (!handler.response.headers.hasOwnProperty('Access-Control-Allow-Origin')) {
      handler.response.headers['Access-Control-Allow-Origin'] = getOrigin(options, handler)
    }
  }

  next(handler.error)
}

module.exports = (opts) => ({
  after: addCorsHeaders.bind(null, opts),
  onError: addCorsHeaders.bind(null, opts)
})
