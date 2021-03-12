const { normalizeHttpResponse } = require('@middy/util')

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
  credentials: undefined,
  headers: undefined,
  methods: undefined,
  origin: '*',
  origins: [],
  exposeHeaders: undefined,
  maxAge: undefined,
  requestHeaders: undefined,
  requestMethods: undefined,
  cacheControl: undefined
}

const httpCorsMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const httpCorsMiddlewareAfter = async (request) => {
    if (!request.event?.httpMethod) return

    request.response = normalizeHttpResponse(request.response)

    const existingHeaders = Object.keys(request.response.headers)

    // Check if already setup the header Access-Control-Allow-Credentials
    if (existingHeaders.includes('Access-Control-Allow-Credentials')) {
      options.credentials =
        request.response.headers['Access-Control-Allow-Credentials'] === 'true'
    }
    if (options.credentials) {
      request.response.headers['Access-Control-Allow-Credentials'] = String(
        options.credentials
      )
    }

    // Check if already setup Access-Control-Allow-Headers
    if (
      options.headers &&
      !existingHeaders.includes('Access-Control-Allow-Headers')
    ) {
      request.response.headers['Access-Control-Allow-Headers'] = options.headers
    }

    // Check if already setup Access-Control-Allow-Methods
    if (
      options.methods &&
      !existingHeaders.includes('Access-Control-Allow-Methods')
    ) {
      request.response.headers['Access-Control-Allow-Methods'] = options.methods
    }

    // Check if already setup the header Access-Control-Allow-Origin
    if (!existingHeaders.includes('Access-Control-Allow-Origin')) {
      const eventHeaders = request.event?.headers ?? {}
      const incomingOrigin = eventHeaders.origin ?? eventHeaders.Origin
      request.response.headers[
        'Access-Control-Allow-Origin'
      ] = options.getOrigin(incomingOrigin, options)
    }

    // Check if already setup Access-Control-Expose-Headers
    if (
      options.exposeHeaders &&
      !existingHeaders.includes('Access-Control-Expose-Headers')
    ) {
      request.response.headers['Access-Control-Expose-Headers'] =
        options.exposeHeaders
    }

    if (options.maxAge && !existingHeaders.includes('Access-Control-Max-Age')) {
      request.response.headers['Access-Control-Max-Age'] = String(
        options.maxAge
      )
    }

    // Check if already setup Access-Control-Request-Headers
    if (
      options.requestHeaders &&
      !existingHeaders.includes('Access-Control-Request-Headers')
    ) {
      request.response.headers['Access-Control-Request-Headers'] =
        options.requestHeaders
    }

    // Check if already setup Access-Control-Request-Methods
    if (
      options?.requestMethods &&
      !existingHeaders.includes('Access-Control-Request-Methods')
    ) {
      request.response.headers['Access-Control-Request-Methods'] =
        options.requestMethods
    }

    if (request.event.httpMethod === 'OPTIONS') {
      if (options.cacheControl && !existingHeaders.includes('Cache-Control')) {
        request.response.headers['Cache-Control'] = String(options.cacheControl)
      }
    }
  }
  const httpCorsMiddlewareOnError = httpCorsMiddlewareAfter
  return {
    after: httpCorsMiddlewareAfter,
    onError: httpCorsMiddlewareOnError
  }
}
module.exports = httpCorsMiddleware
