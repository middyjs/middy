const { normalizeHttpResponse } = require('@middy/util')
const Accept = require('@hapi/accept')

const defaults = {}

const httpResponseSerializerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const httpResponseSerializerMiddlewareAfter = async (request) => {
    // normalise headers for internal use only
    const requestHeaders = getNormalisedHeaders(request.event?.headers ?? {})
    request.response = normalizeHttpResponse(request.response)
    const responseHeaders = getNormalisedHeaders(request.response.headers)

    // skip serialization when content-type is already set
    if (responseHeaders['content-type'] ?? responseHeaders['Content-Type']) {
      return
    }

    // find accept value(s)
    let types

    const requestEvent = request.event
    if (requestEvent?.requiredContentType) {
      types = [].concat(requestEvent.requiredContentType)
    } else {
      types = [].concat(
        (requestHeaders.accept && Accept.mediaTypes(requestHeaders.accept)) ||
          [],
        requestEvent.preferredContentType ?? [],
        options.default ?? []
      )
    }

    // dont bother finding a serializer if no types are given
    if (!types.length) {
      return
    }

    // find in order of first preferred type that has a matching serializer
    types.find((type) =>
      options.serializers.find((s) => {
        const test = s.regex.test(type)

        if (!test) {
          return false
        }

        // set header
        request.response.headers['Content-Type'] = type

        // run serializer
        const result = s.serializer(request.response)

        if (typeof result === 'object') {
          // replace response object if result is object
          request.response = result
        } else {
          // otherwise only replace the body attribute
          request.response.body = result
        }

        return true
      })
    )
  }
  const httpResponseSerializerMiddlewareOnError = httpResponseSerializerMiddlewareAfter
  return {
    after: httpResponseSerializerMiddlewareAfter,
    onError: httpResponseSerializerMiddlewareOnError
  }
}

const getNormalisedHeaders = (source) =>
  Object.keys(source).reduce((destination, key) => {
    destination[key.toLowerCase()] = source[key]

    return destination
  }, {})

module.exports = httpResponseSerializerMiddleware
