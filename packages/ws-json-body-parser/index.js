import { createError } from '@middy/util'

const defaults = {
  reviver: undefined
}

const wsJsonBodyParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const wsJsonBodyParserMiddlewareBefore = async (request) => {
    const { body } = request.event

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

  return {
    before: wsJsonBodyParserMiddlewareBefore
  }
}
export default wsJsonBodyParserMiddleware
