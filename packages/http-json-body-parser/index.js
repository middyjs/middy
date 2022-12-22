import { createError } from '@middy/util'

const mimePattern = /^application\/(.+\+)?json($|;.+)/

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

      request.event.body = JSON.parse(data, reviver)
      request.event.rawBody = body
    } catch (cause) {
      // UnprocessableEntity
      throw createError(422, 'Invalid or malformed JSON was provided', {
        cause
      })
    }
  }

  return {
    before: httpJsonBodyParserMiddlewareBefore
  }
}
export default httpJsonBodyParserMiddleware
