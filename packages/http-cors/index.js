const getOrigin = (incomingOrigin, options) => {
  if (options?.origins.length > 0) {
    if (incomingOrigin && options.origins.includes(incomingOrigin)) {
      return incomingOrigin
    } else {
      return options.origins[0]
    }
  } else {
    if (incomingOrigin && options.credentials && options.origin === '*') {
      return incomingOrigin
    }
    return options.origin
  }
}

const defaults = {
  getOrigin,
  credentials: false,
  headers: false,
  methods: false,
  origin: '*',
  origins: [],
  exposeHeaders: false,
  maxAge: false,
  requestHeaders: false,
  requestMethods: false,
  cacheControl: false
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)
  const httpCorsMiddlewareAfter = async (handler) => {

    if (Object.prototype.hasOwnProperty.call(handler.event, 'httpMethod')) {
      handler.response = handler.response || {}
      handler.response.headers = handler.response.headers || {}

      const existingHeaders = Object.keys(handler.response.headers)

      // Check if already setup the header Access-Control-Allow-Credentials
      if (options.credentials && !existingHeaders.includes('Access-Control-Allow-Credentials')) {
        options.credentials = String(options.credentials)
      }

      // Check if already setup Access-Control-Allow-Headers
      if (options.headers && !existingHeaders.includes( 'Access-Control-Allow-Headers')) {
        handler.response.headers['Access-Control-Allow-Headers'] = options.headers
      }

      // Check if already setup Access-Control-Allow-Methods
      if (options.methods && !existingHeaders.includes('Access-Control-Allow-Methods')) {
        handler.response.headers['Access-Control-Allow-Methods'] = options.methods
      }

      // Check if already setup the header Access-Control-Allow-Origin
      if (options.origin && !existingHeaders.includes( 'Access-Control-Allow-Origin')) {
        const headers = handler.event.headers || {}
        const incomingOrigin = headers.origin || headers.Origin
        handler.response.headers['Access-Control-Allow-Origin'] = options.getOrigin(incomingOrigin, options)
      }

      // Check if already setup Access-Control-Expose-Headers
      if (options.exposeHeaders && !existingHeaders.includes( 'Access-Control-Expose-Headers')) {
        handler.response.headers['Access-Control-Expose-Headers'] = options.exposeHeaders
      }

      if (options.maxAge && !existingHeaders.includes('Access-Control-Max-Age')) {
        handler.response.headers['Access-Control-Max-Age'] = String(options.maxAge)
      }

      // Check if already setup Access-Control-Request-Headers
      if (options.requestHeaders && !existingHeaders.includes( 'Access-Control-Request-Headers')) {
        handler.response.headers['Access-Control-Request-Headers'] = options.requestHeaders
      }

      // Check if already setup Access-Control-Request-Methods
      if (options?.requestMethods && !existingHeaders.includes('Access-Control-Request-Methods')) {
        handler.response.headers['Access-Control-Request-Methods'] = options.requestMethods
      }

      if (handler.event.httpMethod === 'OPTIONS') {
        if (options.cacheControl && !existingHeaders.includes( 'Cache-Control')) {
          handler.response.headers['Cache-Control'] = String(options.cacheControl)
        }
      }
    }
  }
  const httpCorsMiddlewareOnError = httpCorsMiddlewareAfter
  return {
    after: httpCorsMiddlewareAfter,
    onError: httpCorsMiddlewareOnError
  }
}
