const defaults = {
  payloadFormatVersion: 1
}

const httpEventNormalizerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const httpEventNormalizerMiddlewareBefore = async (request) => {
    const { event } = request

    if (isHttpEvent(options.payloadFormatVersion, event)) {
      event.queryStringParameters = event.queryStringParameters ?? {}
      event.pathParameters = event.pathParameters ?? {}
      if (options.payloadFormatVersion === 1) {
        event.multiValueQueryStringParameters =
          event.multiValueQueryStringParameters ?? {}
      }
    }
  }

  return {
    before: httpEventNormalizerMiddlewareBefore
  }
}

const isHttpEvent = (payloadFormatVersion, event) => {
  if (payloadFormatVersion === 1) {
    return Object.prototype.hasOwnProperty.call(event, 'httpMethod')
  } else if (payloadFormatVersion === 2) {
    return Object.prototype.hasOwnProperty.call(event, 'requestContext') &&
      Object.prototype.hasOwnProperty.call(event.requestContext, 'http') &&
      Object.prototype.hasOwnProperty.call(
        event.requestContext.http,
        'method'
      )
  }
  throw new Error('Unknown API Gateway Payload format. Please use value 1 or 2.')
}

module.exports = httpEventNormalizerMiddleware
