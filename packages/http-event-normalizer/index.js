const defaults = {
  payloadFormatVersion: 1
}

const httpEventNormalizerMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const httpEventNormalizerMiddlewareBefore = async (request) => {
    const { event } = request

    if (isHttpEvent(options.payloadFormatVersion, event)) {
      // event.headers ??= {} // Will always have at least on header
      event.queryStringParameters ??= {}
      event.pathParameters ??= {}
      if (options.payloadFormatVersion === 1) {
        event.multiValueQueryStringParameters ??= {}
      }
    }
  }

  return {
    before: httpEventNormalizerMiddlewareBefore
  }
}

const isHttpEvent = (payloadFormatVersion, event) => {
  if (payloadFormatVersion === 2) {
    return event.requestContext?.http?.method !== undefined
  } else if (payloadFormatVersion === 1) {
    return event.httpMethod !== undefined
  }
  throw new Error(
    'Unknown API Gateway Payload format. Please use value 1 or 2.'
  )
}

export default httpEventNormalizerMiddleware
