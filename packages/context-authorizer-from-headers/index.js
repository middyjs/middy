module.exports = (opts) => {
  const defaults = {
    mapper: []
  }

  const { mapper } = Object.assign({}, defaults, opts)

  const mapHeadersToRequestContext = (event) => {
    const { headers, requestContext = {} } = event
    const { authorizer = {} } = requestContext
    mapper.forEach(({ headerKey, contextKey }) => {
      authorizer[contextKey] = headers[headerKey]
    })
    requestContext.authorizer = authorizer
    event.requestContext = requestContext
  }

  return {
    before: ({ event }, next) => {
      if (Array.isArray(mapper)) {
        mapHeadersToRequestContext(event)
      }

      return next()
    }
  }
}
