import { createError } from '@middy/util'
const mimePattern = /^application\/(.+\+)?json(;.*)?$/

const defaults = {
  reviver: undefined
}

const httpJsonBodyParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const httpJsonBodyParserMiddlewareBefore = async (request) => {
    const { headers, body } = request.event

    const contentTypeHeader = headers['Content-Type'] ?? headers['content-type']

    if (body && mimePattern.test(contentTypeHeader)) {
      try {
        const data = request.event.isBase64Encoded
          ? Buffer.from(body, 'base64').toString()
          : body

        request.event.rawBody = body
        request.event.body = JSON.parse(data, options.reviver)
      } catch (cause) {
        // UnprocessableEntity
        // throw createError(422, 'Invalid or malformed JSON was provided', { cause })
        const error = createError(422, 'Invalid or malformed JSON was provided')
        error.cause = cause
        throw error
      }
    }
  }

  return {
    before: httpJsonBodyParserMiddlewareBefore
  }
}
export default httpJsonBodyParserMiddleware
