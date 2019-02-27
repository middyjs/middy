const caseless = require('caseless')

const defaults = {
  origin: '*',
  origins: [],
  headers: null,
  credentials: false
}

const getOrigin = (options, handler) => {
  handler.event.headers = handler.event.headers || {}
  const eventHeaders = caseless(handler.event.headers)

  if (options.origins && options.origins.length > 0) {
    if (eventHeaders.get('Origin') && options.origins.includes(eventHeaders.get('Origin'))) {
      return eventHeaders.get('Origin')
    } else {
      return options.origins[0]
    }
  } else {
    if (eventHeaders.get('Origin') && options.origin === '*') {
      return eventHeaders.get('Origin')
    }
    return options.origin
  }
}

const addCorsHeaders = (opts, handler, next) => {
  if (handler.event.hasOwnProperty('httpMethod')) {
    handler.response = handler.response || {}
    handler.response.headers = handler.response.headers || {}

    const responseHeaders = caseless(handler.response.headers)
    const options = Object.assign({}, defaults, opts)

    // Check if already setup Access-Control-Allow-Headers
    if (options.headers !== null && !responseHeaders.has('Access-Control-Allow-Headers')) {
      responseHeaders.set('Access-Control-Allow-Headers', options.headers)
    }

    if (!responseHeaders.has('Access-Control-Allow-Credentials') && Boolean(options.credentials)) {
      responseHeaders.set('Access-Control-Allow-Credentials', 'true')
    }

    // Check if already setup the header Access-Control-Allow-Origin
    if (!responseHeaders.has('Access-Control-Allow-Origin')) {
      responseHeaders.set('Access-Control-Allow-Origin', getOrigin(options, handler))
    }
  }

  next()
}

module.exports = (opts) => ({
  after: addCorsHeaders.bind(null, opts),
  onError: addCorsHeaders.bind(null, opts)
})
