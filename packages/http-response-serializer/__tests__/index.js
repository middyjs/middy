import test from 'ava'
import middy from '../../core/index.js'
import { createError } from '../../util/index.js'

import httpErrorHandler from '../../http-error-handler/index.js'
import httpResponseSerializer from '../index.js'

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

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
  defaultContentType: 'application/json'
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

    const event = {
      headers: {}
    }
    const response = await handler(event, context)

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

    const response = await handler(event, context)

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

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain'
    },
    body: 'Hello World'
  })
})

test('It should use the defaultContentType when no accept preferences are given', async (t) => {
  const handler = middy((event, context) => createHttpResponse())

  handler.use(httpResponseSerializer(standardConfiguration))

  const event = {
    headers: {}
  }
  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': standardConfiguration.defaultContentType
    },
    body: '{"message":"Hello World"}'
  })
})

test('It should allow the return of the entire response', async (t) => {
  const handler = middy((event, context) => createHttpResponse())

  handler.use(
    httpResponseSerializer({
      serializers: [
        {
          regex: /^application\/json$/,
          serializer: (response) => {
            response.body = JSON.stringify({ message: response.body })
            return response
          }
        }
      ],
      defaultContentType: 'application/json'
    })
  )

  const event = {
    headers: {}
  }
  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': standardConfiguration.defaultContentType
    },
    body: '{"message":"Hello World"}'
  })
})

test('It should use the defaultContentType when no matching accept preferences are found', async (t) => {
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

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': standardConfiguration.defaultContentType
    },
    body: '{"message":"Hello World"}'
  })
})

test('It should use `event.preferredContentType` instead of the defaultContentType', async (t) => {
  const handler = middy((event, context) => {
    event.preferredContentType = 'text/plain'

    return createHttpResponse()
  })

  handler.use(httpResponseSerializer(standardConfiguration))

  const event = {
    headers: {}
  }
  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain'
    },
    body: 'Hello World'
  })
})

test('It should pass-through when no preference or defaultContentType is found', async (t) => {
  const handler = middy((event, context) => createHttpResponse())

  handler.use(
    httpResponseSerializer({
      serializers: standardConfiguration.serializers
    })
  )

  const event = {
    headers: {}
  }
  const response = await handler(event, context)

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

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Content-Type': standardConfiguration.defaultContentType
    },
    body: '{"message":"Hello World"}'
  })
})

test('It should replace the response object when the serializer returns an object with a "body" attribute', async (t) => {
  const handler = middy((event, context) => createHttpResponse())

  handler.use(
    httpResponseSerializer({
      serializers: [
        {
          regex: /^text\/plain$/,
          serializer: (response) =>
            Object.assign({}, response, {
              statusCode: 204,
              body: null
            })
        }
      ],
      defaultContentType: 'text/plain'
    })
  )

  const event = {
    headers: {}
  }
  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 204,
    headers: {
      'Content-Type': 'text/plain'
    },
    body: null
  })
})

test('It should work with `http-error-handler` middleware', async (t) => {
  const handler = middy((event, context) => {
    throw createError(422)
  })

  handler
    .use(httpResponseSerializer(standardConfiguration))
    .use(httpErrorHandler({ logger: false }))

  const event = {
    headers: {}
  }
  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 422,
    body: 'Unprocessable Entity',
    headers: {
      'Content-Type': 'text/plain'
    }
  })
})

test('It should skip if the response is undefined form 502 error', async (t) => {
  const handler = middy((event, context) => {
    throw new Error('test')
  })

  handler.use(httpResponseSerializer(standardConfiguration))

  const event = {
    headers: {}
  }
  try {
    await handler(event, context)
  } catch (e) {
    t.deepEqual(e.message, 'test')
  }
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
  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Content-Type': 'text/plain'
    },
    body: false
  })
})
