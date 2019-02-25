const createError = require('http-errors')
const middy = require('../../core')
const httpErrorHandler = require('../../http-error-handler')
const httpResponseSerializer = require('../')

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

describe('📦  Middleware Http Response Serializer', () => {
  describe('It should pass-through when `content-type` header is already set', () => {
    test.each([
      ['Content-Type'],
      ['content-type'],
      ['CONTENT-TYPE']
    ])(
      '%s skips response serialization',
      (key) => {
        const handlerResponse = {
          ...createHttpResponse(),
          headers: {
            [key]: 'text/plain'
          }
        }
        const handler = middy((event, context, cb) => cb(null, handlerResponse))

        handler.use(httpResponseSerializer(standardConfiguration))

        handler({}, {}, (_, response) => {
          expect(response).toEqual(handlerResponse)
        })
      })
  })

  describe('It should find the correct serializer from the request accept header', () => {
    test.each([
      ['application/xml, text/x-dvi; q=0.8, text/x-c', '<message>Hello World</message>'],
      ['application/json, text/plain, */*', '{"message":"Hello World"}'],
      ['text/plain, text/x-c', 'Hello World']
    ])(
      '%s returns %s',
      (accept, result) => {
        const handler = middy((event, context, cb) => cb(null, createHttpResponse()))

        handler.use(httpResponseSerializer(standardConfiguration))

        const event = {
          headers: {
            'Accept': accept
          }
        }

        handler(event, {}, (_, response) => {
          expect(response.body).toEqual(result)
        })
      })
  })

  test('It should use `event.requiredContentType` instead of accept headers', () => {
    const handler = middy((event, context, cb) => {
      event.requiredContentType = 'text/plain'

      cb(null, createHttpResponse())
    })

    handler.use(httpResponseSerializer(standardConfiguration))

    const event = {
      headers: {
        'Accept': 'application/xml, text/x-dvi; q=0.8, text/x-c'
      }
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'text/plain'
        },
        body: 'Hello World'
      })
    })
  })

  test('It should use the default when no accept preferences are given', () => {
    const handler = middy((event, context, cb) =>
      cb(null, createHttpResponse())
    )

    handler.use(httpResponseSerializer(standardConfiguration))

    handler({}, {}, (_, response) => {
      expect(response).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': standardConfiguration.default
        },
        body: '{"message":"Hello World"}'
      })
    })
  })

  test('It should use `event.preferredContentType` instead of the default', () => {
    const handler = middy((event, context, cb) => {
      event.preferredContentType = 'text/plain'

      cb(null, createHttpResponse())
    })

    handler.use(httpResponseSerializer(standardConfiguration))

    handler({}, {}, (_, response) => {
      expect(response).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'text/plain'
        },
        body: 'Hello World'
      })
    })
  })

  test('It should pass-through when no preference or default is found', () => {
    const handler = middy((event, context, cb) =>
      cb(null, createHttpResponse())
    )

    handler.use(httpResponseSerializer({
      serializers: standardConfiguration.serializers
    }))

    handler({}, {}, (_, response) => {
      expect(response).toEqual({
        statusCode: 200,
        body: 'Hello World'
      })
    })
  })

  test('It should replace the response object when the serializer returns an object', () => {
    const handler = middy((event, context, cb) =>
      cb(null, createHttpResponse())
    )

    handler.use(httpResponseSerializer({
      serializers: [
        {
          regex: /^text\/plain$/,
          serializer: (response) => ({
            ...response,
            body: Buffer.from(response.body).toString('base64'),
            isBase64Encoded: true
          })
        }
      ],
      default: 'text/plain'
    }))

    handler({}, {}, (_, response) => {
      expect(response).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'text/plain'
        },
        body: 'SGVsbG8gV29ybGQ=',
        isBase64Encoded: true
      })
    })
  })

  test('It should work with `http-error-handler` middleware', () => {
    const handler = middy((event, context, cb) => {
      throw new createError.UnprocessableEntity()
    })

    handler
      .use(httpErrorHandler())
      .use(httpResponseSerializer(standardConfiguration))

    handler({}, {}, (_, response) => {
      expect(response).toEqual({
        statusCode: 422,
        body: '{"message":"Unprocessable Entity"}',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    })
  })
})
