const defaults = {
  origin: '*',
  headers: 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
  credentials: false
}

const getOrigin = (options, handler) => {
  if (Object.prototype.hasOwnProperty.call(handler.response.headers, 'Access-Control-Allow-Origin')) {
    return handler.response.headers['Access-Control-Allow-Origin']
  }
  handler.event.headers = handler.event.headers || {}
  if (options.credentials && options.origin === '*' && Object.prototype.hasOwnProperty.call(handler.event.headers, 'Origin')) {
    return handler.event.headers.Origin
  }
  return options.origin
}

const addCorsHeaders = (opts, handler, next) => {
  const options = Object.assign({}, defaults, opts)

  if (Object.prototype.hasOwnProperty.call(handler.event, 'httpMethod')) {
    handler.response = handler.response || {}
    handler.response.headers = handler.response.headers || {}

    // Check if already setup the header Access-Control-Allow-Credentials
    if (Object.prototype.hasOwnProperty.call(handler.response.headers, 'Access-Control-Allow-Credentials')) {
      options.credentials = JSON.parse(handler.response.headers['Access-Control-Allow-Credentials'])
    }
    if (options.credentials) {
      handler.response.headers['Access-Control-Allow-Credentials'] = String(options.credentials)
    }
    handler.response.headers['Access-Control-Allow-Origin'] = getOrigin(options, handler)

    if (!Object.prototype.hasOwnProperty.call(handler.response.headers, 'Access-Control-Allow-Headers')) {
      handler.response.headers['Access-Control-Allow-Headers'] = options.headers
    }
  }

  next()
}

module.exports = (opts) => ({
  after: addCorsHeaders.bind(null, opts),
  onError: addCorsHeaders.bind(null, opts)
})
