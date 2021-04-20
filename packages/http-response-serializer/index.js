const { normalizeHttpResponse } = require('@middy/util')
const Accept = require('@hapi/accept')

const defaults = {
  serializers: [],
  default: undefined
}

const httpResponseSerializerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const httpResponseSerializerMiddlewareAfter = async (request) => {
    if (request.response === undefined) return
    request.response = normalizeHttpResponse(request.response)
    // skip serialization when content-type is already set
    if (
      request.response.headers['Content-Type'] ||
      request.response.headers['content-type']
    ) {
      return
    }

    // find accept value(s)
    let types

    if (request.event?.requiredContentType) {
      types = [request.event.requiredContentType]
    } else {
      const acceptHeader =
        request.event?.headers?.accept ?? request.event?.headers?.Accept
      types = [
        ...((acceptHeader && Accept.mediaTypes(acceptHeader)) ?? []),
        request.event.preferredContentType,
        options.default
      ]
    }

    for (const type of types) {
      let breakTypes
      for (const s of options.serializers) {
        if (!s.regex.test(type)) {
          continue
        }

        request.response.headers['Content-Type'] = type
        const result = s.serializer(request.response)
        if (result?.body) {
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
  const httpResponseSerializerMiddlewareOnError = httpResponseSerializerMiddlewareAfter
  return {
    after: httpResponseSerializerMiddlewareAfter,
    onError: httpResponseSerializerMiddlewareOnError
  }
}

module.exports = httpResponseSerializerMiddleware
