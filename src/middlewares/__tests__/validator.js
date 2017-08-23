const middy = require('../../middy')
const jsonBodyParser = require('../jsonBodyParser')
const validator = require('../validator')

describe('📦  Middleware Validator', () => {
  test('It should validate an incoming object', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    const schema = {
      required: ['headers', 'body'],
      properties: {
        headers: {
          type: 'object'
        },
        body: {
          type: 'object'
        }
      }
    }
    // invokes the handler
    const event = {
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({foo: 'bar'})
    }

    handler.use(jsonBodyParser())
    handler.use(validator(schema))

    handler(event, {}, (_, body) => {
      expect(body).toEqual({foo: 'bar'})
    })
  })

  test('It should handle invalid schema as a BadRequest', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    const schema = {
      required: ['headers', 'body', 'foo'],
      properties: {
        headers: {
          type: 'object'
        },
        body: {
          type: 'object'
        },
        foo: {
          type: 'string'
        }
      }
    }
    handler.use(jsonBodyParser())
    handler.use(validator(schema))
    
    // invokes the handler, note that property foo is missing
    const event = {
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({foo: 'bar'})
    }
    handler(event, {}, (err) => {
      expect(err.message).toEqual('Event object failed validation')
    })
  })

  test('It should validate response', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    const schema = {
      required: ['foo'],
      properties: {
        foo: {
          type: 'string'
        }
      }
    }

    handler.use(jsonBodyParser())
    handler.use(validator(null, schema))

    const event = {
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({foo: 'bar'})
    }

    handler(event, {}, (_, body) => {
      console.error('output valid. 1')
      expect(body).toEqual('{"foo":"bar"}')
    })
  })

  it('should invalidate incorrect responses', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body)
    })
    const schema = {
      required: ['foo'],
      properties: {
        foo: {
          type: 'string'
        }
      }
    }

    handler.use(jsonBodyParser())
    handler.use(validator(null, schema))

    const event = {
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({notfoo: 'bar'})
    }

    handler(event, {}, (_, body) => {
      console.error('output valid. 2')
      expect(body).toEqual('Response object failed validation')
    })
  })
})
