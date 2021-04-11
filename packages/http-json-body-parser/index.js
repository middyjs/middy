const mimePattern = /^application\/(.+\+)?json(;.*)?$/

const defaults = {}

const httpJsonBodyParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const httpJsonBodyParserMiddlewareBefore = async (request) => {
    const { headers, body } = request.event

    const contentTypeHeader =
      headers?.['Content-Type'] ?? headers?.['content-type']

    if (mimePattern.test(contentTypeHeader)) {
      try {
        const data = request.event.isBase64Encoded
          ? Buffer.from(body, 'base64').toString()
          : body

        request.event.body = JSON.parse(data, options.reviver)
      } catch (err) {
        const createError = require('http-errors')
        throw new createError.UnprocessableEntity(
          'Content type defined as JSON but an invalid JSON was provided'
        )
      }
    }
  }

  return {
    before: httpJsonBodyParserMiddlewareBefore
  }
}
module.exports = httpJsonBodyParserMiddleware
