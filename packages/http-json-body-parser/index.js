import { createError } from '@middy/util'

const mimePattern = /^application\/(.+\+)?json($|;.+)/

const defaults = {
  reviver: undefined,
  disableContentTypeError: true,
  asDefaultContentType: false,
}

const httpJsonBodyParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const httpJsonBodyParserMiddlewareBefore = async (request) => {
    const { headers, body } = request.event

    const contentType = headers?.['Content-Type'] ?? headers?.['content-type'] 
      ?? asDefaultContentType ? 'application/json' : undefined

    if (!mimePattern.test(contentType)) {
      if (options.disableContentTypeError) {
        return
      }
      throw createError(415, 'Unsupported Media Type', {
        cause: contentType
      })
    }

    try {
      const data = request.event.isBase64Encoded
        ? Buffer.from(body, 'base64').toString()
        : body

      request.event.body = JSON.parse(data, options.reviver)
    } catch (cause) {
      // UnprocessableEntity
      throw createError(415, 'Invalid or malformed JSON was provided', {
        cause
      })
    }
  }

  return {
    before: httpJsonBodyParserMiddlewareBefore
  }
}
export default httpJsonBodyParserMiddleware
