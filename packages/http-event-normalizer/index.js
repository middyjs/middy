const httpEventNormalizerMiddleware = () => {
  const httpEventNormalizerMiddlewareBefore = async (request) => {
    const { event } = request

    const version = pickVersion(event)
    const isHttpEvent = isVersionHttpEvent[version]?.(event)
    if (!isHttpEvent) {
      throw new Error('[http-event-normalizer] Unknown http event format')
    }
    // VPC Lattice is an http event, however uses a different notation
    // - query_string_parameters
    // - is_base64_encoded

    if (version === '1.0') {
      event.multiValueQueryStringParameters ??= {}
    } else if (version === 'vpc') {
      event.queryStringParameters = event.query_string_parameters
      event.isBase64Encoded = event.is_base64_encoded
    }

    // event.headers ??= {} // Will always have at least one header
    event.pathParameters ??= {}
    event.queryStringParameters ??= {}
  }

  return {
    before: httpEventNormalizerMiddlewareBefore
  }
}

const pickVersion = (event) => {
  // '1.0' is a safer default
  return event.version ?? (event.httpMethod ? '1.0' : event.method ? 'vpc' : '1.0')
}

const isVersionHttpEvent = {
  '1.0': (event) => typeof event.httpMethod !== 'undefined',
  '2.0': (event) => typeof event.requestContext.http.method !== 'undefined',
  vpc: (event) => typeof event.method !== 'undefined'
}

export default httpEventNormalizerMiddleware
