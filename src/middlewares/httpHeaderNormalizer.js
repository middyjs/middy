module.exports = (opts) => {
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

  const normalizeHeaderKey = (key) => {
    if (exceptions[key.toLowerCase()]) {
      return exceptions[key.toLowerCase()]
    }

    return key
      .split('-')
      .map(text =>
        text.charAt(0).toUpperCase() + text.substr(1).toLowerCase()
      )
      .join('-')
  }

  const defaults = {
    normalizeHeaderKey
  }

  const options = Object.assign({}, defaults, opts)

  return ({
    before: (handler, next) => {
      if (handler.event.headers) {
        const rawHeaders = {}
        const headers = {}

        Object.keys(handler.event.headers).forEach((key) => {
          rawHeaders[key] = handler.event.headers[key]
          headers[options.normalizeHeaderKey(key)] = handler.event.headers[key]
        })

        handler.event.headers = headers
        handler.event.rawHeaders = rawHeaders
      }

      if (handler.event.multiValueHeaders) {
        const rawHeaders = {}
        const headers = {}

        Object.keys(handler.event.multiValueHeaders).forEach((key) => {
          rawHeaders[key] = handler.event.multiValueHeaders[key]
          headers[options.normalizeHeaderKey(key)] = handler.event.multiValueHeaders[key]
        })

        handler.event.multiValueHeaders = headers
        handler.event.rawMultiValueHeaders = rawHeaders
      }

      next()
    }
  })
}
