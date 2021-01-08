const Accept = require('@hapi/accept')

const defaults = {}

module.exports = (opts = {}) => {
  const options = Object.assign({}, defaults, opts)
  const httpResponseSerializerMiddlewareAfter = async (handler) => {
    // normalise headers for internal use only
    const requestHeaders = getNormalisedHeaders(handler.event?.headers ?? {})
    const responseHeaders = getNormalisedHeaders(handler.response?.headers ?? {})

    // skip serialization when content-type is already set
    if (responseHeaders['content-type']) {
      return
    }

    // find accept value(s)
    let types

    const handlerEvent = handler.event
    if (handlerEvent?.requiredContentType) {
      types = [].concat(handlerEvent.requiredContentType)
    } else {
      types = [].concat(
        (requestHeaders.accept && Accept.mediaTypes(requestHeaders.accept)) || [],
        handlerEvent.preferredContentType || [],
        options.default || []
      )
    }

    // dont bother finding a serializer if no types are given
    if (!types.length) {
      return
    }

    // find in order of first preferred type that has a matching serializer
    types.find(type => options.serializers.find(s => {
      const test = s.regex.test(type)

      if (!test) { return false }

      // if the response is not an object, assign it to body. { body: undefined } is not serialized
      handler.response = handler.response !== null && typeof handler.response === 'object'
        ? handler.response
        : { body: handler.response }

      // set header
      handler.response.headers = handler.response?.headers ?? {}
      handler.response.headers = Object.assign({}, handler.response.headers, { 'Content-Type': type })

      // run serializer
      const result = s.serializer(handler.response)

      if (typeof result === 'object') {
        // replace response object if result is object
        handler.response = result
      } else {
        // otherwise only replace the body attribute
        handler.response.body = result
      }

      return true
    }))
  }
  const httpResponseSerializerMiddlewareOnError = httpResponseSerializerMiddlewareAfter
  return {
    after: httpResponseSerializerMiddlewareAfter,
    onError: httpResponseSerializerMiddlewareOnError
  }
}

const getNormalisedHeaders = (source) => Object
  .keys(source)
  .reduce((destination, key) => {
    destination[key.toLowerCase()] = source[key]

    return destination
  }, {})
