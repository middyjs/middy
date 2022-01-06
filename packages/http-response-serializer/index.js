const { normalizeHttpResponse } = require('@middy/util')
const Accept = require('@hapi/accept')

const defaults = {
  serializers: [],
  defaultContentType: undefined
}

const httpResponseSerializerMiddleware = (opts = {}) => {
  const {serializers, defaultContentType} = { ...defaults, ...opts }
  const httpResponseSerializerMiddlewareAfter = async (request) => {
    normalizeHttpResponse(request)

    // skip serialization when Content-Type is already set
    if (request.response.headers['Content-Type']) return

    // find accept value(s)
    let types

    if (request.event?.requiredContentType) {
      types = [request.event.requiredContentType]
    } else {
      const acceptHeader = request.event?.headers?.Accept ?? request.event?.headers?.accept
      types = [
        ...((acceptHeader && Accept.mediaTypes(acceptHeader)) ?? []),
        request.event.preferredContentType,
        defaultContentType
      ]
    }

    for (const type of types) {
      let breakTypes
      for (const s of serializers) {
        if (!s.regex.test(type)) {
          continue
        }

        request.response.headers['Content-Type'] = type
        const result = s.serializer(request.response)
        if (typeof result === 'object' && 'body' in result) {
          request.response = result
        } else {
          // otherwise only replace the body attribute
          request.response.body = result
        }

        breakTypes = true
        break
      }
      if (breakTypes) break
    }
  }

  const httpResponseSerializerMiddlewareOnError = async (request) => {
    if (request.response === undefined) return
    return httpResponseSerializerMiddlewareAfter(request)
  }
  return {
    after: httpResponseSerializerMiddlewareAfter,
    onError: httpResponseSerializerMiddlewareOnError
  }
}

module.exports = httpResponseSerializerMiddleware
