const Accept = require('accept')

const getNormalisedHeaders = (source) => Object
  .keys(source)
  .reduce((destination, key) => {
    destination[key.toLowerCase()] = source[key]

    return destination
  }, {})

const middleware = (opts, handler, next) => {
  // normalise headers for internal use only
  const requestHeaders = getNormalisedHeaders((handler.event && handler.event.headers) || {})
  const responseHeaders = getNormalisedHeaders((handler.response && handler.response.headers) || {})

  // skip serialization when content-type is already set
  if (responseHeaders['content-type']) {
    return next()
  }

  // find accept value(s)
  let types

  if (handler.event.requiredContentType) {
    types = [].concat(handler.event.requiredContentType)
  } else {
    types = [].concat(
      (requestHeaders.accept && Accept.mediaTypes(requestHeaders.accept)) || [],
      handler.event.preferredContentType || [],
      opts.default || []
    )
  }

  // dont bother finding a serializer if no types are given
  if (!types.length) {
    return next()
  }

  // find in order of first preferred type that has a matching serializer
  types.find(type => opts.serializers.map(s => {
    const test = s.regex.test(type)

    if (!test) { return false }

    // if the response is not an object, assign it to body. { body: undefined } is not serialized
    handler.response = typeof handler.response === 'object' ? handler.response : { body: handler.response }

    // set header
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

  next()
}

module.exports = opts => {
  return {
    after: (handler, next) => middleware(opts, handler, next),
    onError: (handler, next) => middleware(opts, handler, next)
  }
}
