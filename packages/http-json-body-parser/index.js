const mimePattern = /^application\/(.+\+)?json(;.*)?$/

const defaults = {
  reviver: undefined
}

const httpJsonBodyParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const httpJsonBodyParserMiddlewareBefore = async (request) => {
    const { headers, body } = request.event

    const contentTypeHeader = headers['Content-Type'] ?? headers['content-type']

    if (mimePattern.test(contentTypeHeader)) {
      try {
        const data = request.event.isBase64Encoded
          ? Buffer.from(body, 'base64').toString()
          : body

        request.event.rawBody = body
        request.event.body = JSON.parse(data, options.reviver)
      } catch (err) {
        const { createError } = require('@middy/util')
        // UnprocessableEntity
        throw createError(422, 'Content type defined as JSON but an invalid JSON was provided')
      }
    }
  }

  return {
    before: httpJsonBodyParserMiddlewareBefore
  }
}
module.exports = httpJsonBodyParserMiddleware
