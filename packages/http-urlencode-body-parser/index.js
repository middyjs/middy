const contentType = require('content-type')
const { parse } = require('qs')

const httpUrlencodeBodyParserMiddlewareBefore = async (handler) => {
  if (!handler.event?.headers) return
  const contentTypeHeader = handler.event.headers?.['content-type'] ?? handler.event.headers?.['Content-Type']
  if (!contentTypeHeader) return
  const { type } = contentType.parse(contentTypeHeader)

  if (type === 'application/x-www-form-urlencoded') {
    const body = handler.event.isBase64Encoded
      ? Buffer.from(handler.event.body, 'base64').toString()
      : handler.event.body
    handler.event.body = parse(body)
  }
}

module.exports = () => ({
  before: httpUrlencodeBodyParserMiddlewareBefore
})
