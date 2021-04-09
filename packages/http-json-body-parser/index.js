
const pattern = new RegExp(/^application\/(.+\+)?json(;.*)?$/)

const defaults = {}

const httpJsonBodyParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const httpJsonBodyParserMiddlewareBefore = async (request) => {
    if (!request.event?.headers) return

    const contentTypeHeader = request.event?.headers['content-type'] ?? request.event?.headers['Content-Type']

    if (pattern.test(contentTypeHeader)) {
      try {
        const data = request.event.isBase64Encoded
          ? Buffer.from(request.event.body, 'base64').toString()
          : request.event.body

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
