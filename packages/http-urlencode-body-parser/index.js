const contentType = require('content-type')
const { parse } = require('qs')

const httpUrlencodeBodyParserMiddlewareBefore = async (request) => {
  if (!request.event?.headers) return
  const contentTypeHeader =
    request.event.headers?.['Content-Type'] ??
    request.event.headers?.['content-type']
  if (!contentTypeHeader) return
  const { type } = contentType.parse(contentTypeHeader)

  if (type === 'application/x-www-form-urlencoded') {
    const body = request.event.isBase64Encoded
      ? Buffer.from(request.event.body, 'base64').toString()
      : request.event.body
    request.event.body = parse(body)
  }
}

const httpUrlencodeBodyParserMiddleware = () => ({
  before: httpUrlencodeBodyParserMiddlewareBefore
})
module.exports = httpUrlencodeBodyParserMiddleware
