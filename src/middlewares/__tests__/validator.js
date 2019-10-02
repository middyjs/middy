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
      body: JSON.stringify({ foo: 'bar' })
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
      body: JSON.stringify({ something: 'somethingelse' })
    }
    handler(event, {}, (err, res) => {
      expect(err.message).toEqual('Event object failed validation')
      expect(err.details).toEqual([{ 'dataPath': '', 'keyword': 'required', 'message': 'should have required property foo', 'params': { 'missingProperty': 'foo' }, 'schemaPath': '#/required' }])
    })
  })

  test('It should handle invalid schema as a BadRequest in a different language', () => {
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
      preferredLanguage: 'fr',
      body: JSON.stringify({ something: 'somethingelse' })
    }
    handler(event, {}, (err, res) => {
      expect(err.message).toEqual('Event object failed validation')
      expect(err.details).toEqual([{ 'dataPath': '', 'keyword': 'required', 'message': 'requiert la propriété foo', 'params': { 'missingProperty': 'foo' }, 'schemaPath': '#/required' }])
    })
  })

  test('It should handle invalid schema as a BadRequest in a different language (with normalization)', () => {
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
      preferredLanguage: 'pt',
      body: JSON.stringify({ something: 'somethingelse' })
    }
    handler(event, {}, (err, res) => {
      expect(err.message).toEqual('Event object failed validation')
      expect(err.details).toEqual([{ 'dataPath': '', 'keyword': 'required', 'message': 'deve ter a propriedade requerida foo', 'params': { 'missingProperty': 'foo' }, 'schemaPath': '#/required' }])
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

    handler.use(validator({ outputSchema: schema }))

    handler({}, {}, (err, response) => {
      expect(err).toBe(null)
      expect(response).toBe(expectedResponse)
    })
  })

  test('It should make requests with invalid responses fail with an Internal Server Error', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
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

    handler.use(validator({ outputSchema: schema }))

    handler({}, {}, (err, response) => {
      expect(err).not.toBe(null)
      expect(err.message).toEqual('Response object failed validation')
      expect(response).not.toBe(null) // it doesn't destroy the response so it gets logged
    })
  })

  describe('🏗 Ajv constructor options', () => {
    const schema = { required: ['email'], properties: { email: { type: 'string', format: 'email' } } }

    test('It should allow invalid email using default constructor options', () => {
      const handler = middy((event, context, cb) => {
        cb(null, {})
      })

      handler.use(validator({ inputSchema: schema }))

      // This email is considered as valid in 'fast' mode
      handler({ email: 'abc@abc' }, {}, (err) => {
        expect(err).toEqual(null)
      })
    })

    test('It should not allow bad email format using custom ajv constructor options', () => {
      const handler = middy((event, context, cb) => {
        cb(null, {})
      })

      handler.use(validator({ inputSchema: schema, ajvOptions: { format: 'full' } }))

      // This same email is not a valid one in 'full' validation mode
      handler({ email: 'abc@abc' }, {}, (err) => {
        expect(err.details[0].message).toEqual('should match format "email"')
      })
    })
  })
})
