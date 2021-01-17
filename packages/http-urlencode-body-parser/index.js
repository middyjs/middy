const contentType = require('content-type')

const defaults = {
  extended: false
}

module.exports = (opts) => {
  const options = Object.assign({}, defaults, opts)
  const parserFn = options.extended ? require('qs').parse : require('querystring').decode
  return {
    before: (handler, next) => {
      if (handler.event.headers) {
        const contentTypeHeader = handler.event.headers['content-type'] || handler.event.headers['Content-Type']
        if (contentTypeHeader) {
          const { type } = contentType.parse(contentTypeHeader)

          if (type === 'application/x-www-form-urlencoded') {
            const data = handler.event.isBase64Encoded
              ? Buffer.from(handler.event.body, 'base64').toString()
              : handler.event.body
            handler.event.body = parserFn(data)
          }
        }
      }

      next()
    }
  }
}
