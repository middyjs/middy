module.exports = opts => {
  const defaults = {
    payloadFormatVersion: 1
  }

  const options = Object.assign({}, defaults, opts)

  return {
    before: (handler, next) => {
      const { event } = handler
      let isHttpEvent = false

      switch (options.payloadFormatVersion) {
        case 1:
          isHttpEvent = Object.prototype.hasOwnProperty.call(event, 'httpMethod')
          break
        case 2:
          isHttpEvent = Object.prototype.hasOwnProperty.call(event, 'requestContext') &&
            Object.prototype.hasOwnProperty.call(event.requestContext, 'http') &&
            Object.prototype.hasOwnProperty.call(event.requestContext.http, 'method')
          break
        default:
          throw new Error('Unknow API Gateway Payload format. Please use value 1 or 2.')
      }

      if (isHttpEvent) {
        event.queryStringParameters = event.queryStringParameters || {}
        event.pathParameters = event.pathParameters || {}
        if (options.payloadFormatVersion === 1) {
          event.multiValueQueryStringParameters = event.multiValueQueryStringParameters || {}
        }
      }

      return next()
    }
  }
}
