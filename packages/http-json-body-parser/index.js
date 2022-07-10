import { createError } from '@middy/util'

const mimePattern = /^application\/(.+\+)?json(;.*)?$/

const defaults = {
  reviver: undefined
}

const httpJsonBodyParserMiddleware = (opts = {}) => {
  const { reviver } = { ...defaults, ...opts }
  const httpJsonBodyParserMiddlewareBefore = async (request) => {
    const { headers, body } = request.event

    const contentType = headers['Content-Type'] ?? headers['content-type']

    if (!mimePattern.test(contentType)) return

    try {
      const data = request.event.isBase64Encoded
        ? Buffer.from(body, 'base64').toString()
        : body

      request.event.rawBody = body // TODO deprecate in v4
      request.event.body = JSON.parse(data, reviver)
    } catch (cause) {
      // UnprocessableEntity
      // throw createError(422, 'Invalid or malformed JSON was provided', { cause })
      const error = createError(422, 'Invalid or malformed JSON was provided')
      error.cause = cause
      throw error
    }
  }

  return {
    before: httpJsonBodyParserMiddlewareBefore
  }
}
export default httpJsonBodyParserMiddleware
