const { normalizeHttpResponse } = require('@middy/util')
const Accept = require('@hapi/accept')

const defaults = {}

const httpResponseSerializerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  const httpResponseSerializerMiddlewareAfter = async (request) => {
    request.response = normalizeHttpResponse(request.response)
    // skip serialization when content-type is already set
    if (request.response.headers['Content-Type'] || request.response.headers['content-type']) return

    // find accept value(s)
    let types

    const requestEvent = request.event
    if (requestEvent?.requiredContentType) {
      types = [].concat(requestEvent.requiredContentType)
    } else {
      const acceptHeader = request.event?.headers?.accept ?? request.event?.headers?.Accept
      types = [].concat(
        (acceptHeader && Accept.mediaTypes(acceptHeader)) ?? [],
        requestEvent.preferredContentType ?? [],
        options.default ?? []
      )
    }

    // dont bother finding a serializer if no types are given
    if (!types.length) return

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
        request.response.body = s.serializer(request.response)

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

module.exports = httpResponseSerializerMiddleware
