module.exports = (opts) => {
  const exceptions = {
    'content-md5': 'Content-MD5',
    'dnt': 'DNT',
    'etag': 'ETag',
    'last-event-id': 'Last-Event-ID',
    'tcn': 'TCN',
    'te': 'TE',
    'www-authenticate': 'WWW-Authenticate',
    'x-dnsprefetch-control': 'X-DNSPrefetch-Control'
  }

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

      next()
    }
  })
}
