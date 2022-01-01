const { parse } = require('qs')

const mimePattern = /^application\/x-www-form-urlencoded(;.*)?$/

const httpUrlencodeBodyParserMiddlewareBefore = async (request) => {
  const { headers, body } = request.event
  const contentTypeHeader = headers?.['Content-Type']

  if (mimePattern.test(contentTypeHeader)) {
    const data = request.event.isBase64Encoded
      ? Buffer.from(body, 'base64').toString()
      : body
    request.event.body = parse(data)
  }
}

const httpUrlencodeBodyParserMiddleware = () => ({
  before: httpUrlencodeBodyParserMiddlewareBefore
})
module.exports = httpUrlencodeBodyParserMiddleware
