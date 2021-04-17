const exceptionsList = [
  'ALPN',
  'C-PEP',
  'C-PEP-Info',
  'CalDAV-Timezones',
  'Content-ID',
  'Content-MD5',
  'DASL',
  'DAV',
  'DNT',
  'ETag',
  'GetProfile',
  'HTTP2-Settings',
  'Last-Event-ID',
  'MIME-Version',
  'Optional-WWW-Authenticate',
  'Sec-WebSocket-Accept',
  'Sec-WebSocket-Extensions',
  'Sec-WebSocket-Key',
  'Sec-WebSocket-Protocol',
  'Sec-WebSocket-Version',
  'SLUG',
  'TCN',
  'TE',
  'TTL',
  'WWW-Authenticate',
  'X-ATT-DeviceId',
  'X-DNSPrefetch-Control',
  'X-UIDH'
]

const exceptions = exceptionsList.reduce((acc, curr) => {
  acc[curr.toLowerCase()] = curr
  return acc
}, {})

const normalizeHeaderKey = (key, canonical) => {
  if (exceptions[key.toLowerCase()]) {
    return exceptions[key.toLowerCase()]
  }

  if (!canonical) {
    return key.toLowerCase()
  }

  return key
    .split('-')
    .map((text) => text[0].toUpperCase() + text.substr(1).toLowerCase())
    .join('-')
}

const defaults = {
  canonical: false,
  normalizeHeaderKey
}

const httpHeaderNormalizerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const httpHeaderNormalizerMiddlewareBefore = async (request) => {
    if (request.event.headers) {
      const rawHeaders = {}
      const headers = {}

      Object.keys(request.event.headers).forEach((key) => {
        rawHeaders[key] = request.event.headers[key]
        headers[options.normalizeHeaderKey(key, options.canonical)] =
          request.event.headers[key]
      })

      request.event.headers = headers
      request.event.rawHeaders = rawHeaders
    }

    if (request.event.multiValueHeaders) {
      const rawHeaders = {}
      const headers = {}

      Object.keys(request.event.multiValueHeaders).forEach((key) => {
        rawHeaders[key] = request.event.multiValueHeaders[key]
        headers[options.normalizeHeaderKey(key, options.canonical)] =
          request.event.multiValueHeaders[key]
      })

      request.event.multiValueHeaders = headers
      request.event.rawMultiValueHeaders = rawHeaders
    }
  }

  return {
    before: httpHeaderNormalizerMiddlewareBefore
  }
}

module.exports = httpHeaderNormalizerMiddleware
