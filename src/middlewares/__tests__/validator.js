const middy = require('../../middy')
const validator = require('../validator')

describe('📦  Middleware Validator', () => {
  test('It should validate an incoming object', () => {
    const handler = middy((event, context, cb) => {
      return cb(null, event.body) // propagates the body as a response
    })

    const schema = {
      required: ['body'],
      properties: {
        body: {
          type: 'string'
        }
      }
    }

    handler.use(validator({
      inputSchema: schema
    }))

    // invokes the handler
    const event = {
      body: JSON.stringify({foo: 'bar'})
    }
    handler(event, {}, (err, body) => {
      expect(err).toEqual(null)
      expect(body).toEqual('{"foo":"bar"}')
    })
  })

  test('It should handle invalid schema as a BadRequest', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    const schema = {
      required: ['body', 'foo'],
      properties: {
        // this will pass validation
        body: {
          type: 'string'
        },
        // this won't as it won't be in the event
        foo: {
          type: 'string'
        }
      }
    }

    handler.use(validator({
      inputSchema: schema
    }))

    // invokes the handler, note that property foo is missing
    const event = {
      body: JSON.stringify({something: 'somethingelse'})
    }
    handler(event, {}, (err, res) => {
      expect(err.message).toEqual('Event object failed validation')
    })
  })

  test('It should validate response', () => {
    const expectedResponse = {
      body: 'Hello world',
      statusCode: 200
    }

    const handler = middy((event, context, cb) => {
      cb(null, expectedResponse)
    })

    const schema = {
      required: ['body', 'statusCode'],
      properties: {
        body: {
          type: 'string'
        },
        statusCode: {
          type: 'number'
        }
      }
    }

    handler.use(validator({outputSchema: schema}))

    handler({}, {}, (err, response) => {
      expect(err).toBe(null)
      expect(response).toBe(expectedResponse)
    })
  })

  test('It should make requests with invalid responses fail with an Internal Server Error', () => {
    const expectedResponse = {
      body: 'Hello world',
      statusCode: 200
    }

    const handler = middy((event, context, cb) => {
      cb(null, expectedResponse)
    })

    const schema = {
      required: ['body', 'statusCode'],
      properties: {
        body: {
          type: 'object'
        },
        statusCode: {
          type: 'number'
        }
      }
    }

    handler.use(validator({outputSchema: schema}))

    handler({}, {}, (err, response) => {
      expect(err).not.toBe(null)
      expect(err.message).toEqual('Response object failed validation')
      expect(response).not.toBe(null) // it doesn't destroy the response so it gets logged
    })
  })
})
