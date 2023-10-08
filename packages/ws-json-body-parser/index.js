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

      request.event.body = JSON.parse(data, options.reviver)
    } catch (err) {
      // UnprocessableEntity
      throw createError(422, 'Invalid or malformed JSON was provided', {
        cause: { package: '@middy/ws-json-body-parser', data: err }
      })
    }
  }

  return {
    before: wsJsonBodyParserMiddlewareBefore
  }
}
export default wsJsonBodyParserMiddleware
