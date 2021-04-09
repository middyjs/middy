const test = require('ava')
const middy = require('../../core/index.js')
const createError = require('http-errors')

const httpErrorHandler = require('../../http-error-handler/index.js')
const httpResponseSerializer = require('../index.js')

const standardConfiguration = {
  serializers: [
    {
      regex: /^application\/xml$/,
      serializer: ({ body }) => `<message>${body}</message>`
    },
    {
      regex: /^application\/json$/,
      serializer: ({ body }) => JSON.stringify({ message: body })
    },
    {
      regex: /^text\/plain$/,
      serializer: ({ body }) => body
    }
  ],
  default: 'application/json'
}

const createHttpResponse = () => ({
  statusCode: 200,
  body: 'Hello World'
})

for (const [key] of [['Content-Type'], ['content-type']]) {
  test(`${key} skips response serialization`, async (t) => {
    const handlerResponse = Object.assign({}, createHttpResponse(), {
      headers: {
        [key]: 'text/plain'
      }
    })
    const handler = middy((event, context) => handlerResponse)

    handler.use(httpResponseSerializer(standardConfiguration))

    const response = await handler()

    t.is(response, handlerResponse)
  })
}

for (const [accept, result] of [
  [
    'application/xml, text/x-dvi; q=0.8, text/x-c',
    '<message>Hello World</message>'
  ],
  [
    'text/x-dvi; q=0.8, application/xml, text/x-c',
    '<message>Hello World</message>'
  ],
  ['text/x-dvi, application/xml, text/x-c', '<message>Hello World</message>'],
  ['application/json, text/plain, */*', '{"message":"Hello World"}'],
  ['*/*', '{"message":"Hello World"}'],
  ['text/x-dvi, */*', '{"message":"Hello World"}'],
  ['text/plain, text/x-c', 'Hello World']
]) {
  test(`${accept} returns ${result}`, async (t) => {
    const handler = middy((event, context) => createHttpResponse())

    handler.use(httpResponseSerializer(standardConfiguration))

    const event = {
      headers: {
        Accept: accept
      }
    }

    const response = await handler(event)

    t.is(response.body, result)
  })
}

test('It should use `event.requiredContentType` instead of accept headers', async (t) => {
  const handler = middy((event, context) => {
    event.requiredContentType = 'text/plain'

    return createHttpResponse()
  })

  handler.use(httpResponseSerializer(standardConfiguration))

  const event = {
    headers: {
      Accept: 'application/xml, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const response = await handler(event)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain'
    },
    body: 'Hello World'
  })
})

test('It should use the default when no accept preferences are given', async (t) => {
  const handler = middy((event, context) => createHttpResponse())

  handler.use(httpResponseSerializer(standardConfiguration))

  const response = await handler()

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': standardConfiguration.default
    },
    body: '{"message":"Hello World"}'
  })
})

test('It should use the default when no matching accept preferences are found', async (t) => {
  const handler = middy((event, context) => {
    event.preferredContentType = 'text/java'

    return createHttpResponse()
  })

  handler.use(httpResponseSerializer(standardConfiguration))

  const event = {
    headers: {
      Accept: 'application/java, text/x-dvi; q=0.8, text/x-c'
    }
  }

  const response = await handler(event)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': standardConfiguration.default
    },
    body: '{"message":"Hello World"}'
  })
})

test('It should use `event.preferredContentType` instead of the default', async (t) => {
  const handler = middy((event, context) => {
    event.preferredContentType = 'text/plain'

    return createHttpResponse()
  })

  handler.use(httpResponseSerializer(standardConfiguration))

  const response = await handler()

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain'
    },
    body: 'Hello World'
  })
})

test('It should pass-through when no preference or default is found', async (t) => {
  const handler = middy((event, context) => createHttpResponse())

  handler.use(
    httpResponseSerializer({
      serializers: standardConfiguration.serializers
    })
  )

  const response = await handler()

  t.deepEqual(response, {
    statusCode: 200,
    headers: {},
    body: 'Hello World'
  })
})

test('It should not pass-through when request content-type is set', async (t) => {
  const handler = middy((event, context) => createHttpResponse())

  handler.use(httpResponseSerializer(standardConfiguration))

  const event = {
    headers: {
      'Content-Type': 'application/xml'
    }
  }

  const response = await handler(event)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': standardConfiguration.default
    },
    body: '{"message":"Hello World"}'
  })
})

test('It should replace the response object when the serializer returns an object', async (t) => {
  const handler = middy((event, context) => createHttpResponse())

  handler.use(
    httpResponseSerializer({
      serializers: [
        {
          regex: /^text\/plain$/,
          serializer: (response) => {
            Object.assign(response, {
              isBase64Encoded: true
            })
            return Buffer.from(response.body).toString('base64')
          }
        }
      ],
      default: 'text/plain'
    })
  )

  const response = await handler()

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain'
    },
    body: 'SGVsbG8gV29ybGQ=',
    isBase64Encoded: true
  })
})

test('It should work with `http-error-handler` middleware', async (t) => {
  const handler = middy((event, context) => {
    throw new createError.UnprocessableEntity()
  })

  handler
    .use(httpResponseSerializer(standardConfiguration))
    .use(httpErrorHandler({ logger: false }))

  const response = await handler()

  t.deepEqual(response, {
    statusCode: 422,
    body: 'Unprocessable Entity',
    headers: {
      'Content-Type': 'plain/text'
    }
  })
})

test('It should not crash if the response is undefined', async (t) => {
  const handler = middy((event, context) => undefined)

  handler.use(httpResponseSerializer(standardConfiguration))

  const event = {
    headers: {
      'Content-Type': 'application/xml'
    }
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Content-Type': standardConfiguration.default
    },
    body: '{}'
  })
})

test('It should return false when response body is falsey', async (t) => {
  const handler = middy((event, context) => {
    return false
  })

  const event = {
    headers: {
      Accept: 'text/plain'
    }
  }
  handler.use(httpResponseSerializer(standardConfiguration))
  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Content-Type': 'text/plain'
    },
    body: false
  })
})
