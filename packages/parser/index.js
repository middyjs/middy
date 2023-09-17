import { createError } from '@middy/util'

export const eventParsingErrorMessage = 'Event object failed parsing'
export const contextParsingErrorMessage = 'Context object failed parsing'
export const responseParsingErrorMessage = 'Response object failed parsing'

/**
 * @type {import('./index').default}
 */
const parserMiddleware = ({
  eventSchema,
  contextSchema,
  responseSchema,
  createErrorFunc = createError
} = {}) => {
  /**
   * @param {import('@middy/core').Request} request
   */
  const parserMiddlewareBefore = (request) => {
    if (eventSchema) {
      const parseResult = eventSchema.safeParse(request.event)

      if (!parseResult.success) {
        // Bad Request
        throw createErrorFunc(400, eventParsingErrorMessage, {
          cause: parseResult.error
        })
      }
      // assign the parsed event back
      request.event = parseResult.data
    }

    if (contextSchema) {
      const parseResult = contextSchema.safeParse(request.context)

      if (!parseResult.success) {
        // Internal Server Error
        throw createErrorFunc(500, contextParsingErrorMessage, {
          cause: parseResult.error
        })
      }
      // assign the parsed context back
      request.context = parseResult.data
    }
  }

  /**
   * @param {import('@middy/core').Request} request
   */
  const parserMiddlewareAfter = (request) => {
    const parseResult = responseSchema.safeParse(request.response)

    if (!parseResult.success) {
      // Internal Server Error
      throw createErrorFunc(500, responseParsingErrorMessage, {
        cause: parseResult.error
      })
    }
    // assign the parsed result back
    request.response = parseResult.data
  }

  return {
    before: eventSchema ?? contextSchema ? parserMiddlewareBefore : undefined,
    after: responseSchema ? parserMiddlewareAfter : undefined
  }
}

export default parserMiddleware
