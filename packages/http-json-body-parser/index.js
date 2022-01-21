const mimePattern = /^application\/(.+\+)?json(;.*)?$/

const defaults = {
  reviver: undefined,
  rejectMsg: 'Content type defined as JSON but an invalid JSON was provided'
}

const httpJsonBodyParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const httpJsonBodyParserMiddlewareBefore = async (request) => {
    const { headers, body } = request.event

    const contentTypeHeader = headers?.['Content-Type']

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
        throw createError(422, rejectMsg)
      }
    }
  }

  return {
    before: httpJsonBodyParserMiddlewareBefore
  }
}
module.exports = httpJsonBodyParserMiddleware
