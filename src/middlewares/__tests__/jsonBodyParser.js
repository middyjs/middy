const middy = require('../../middy')
const jsonBodyParser = require('../jsonBodyParser')

describe('📦  Middleware JSON Body Parser', () => {
  test('It should parse a JSON request', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    handler.use(jsonBodyParser())

    // invokes the handler
    const event = {
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ foo: 'bar' })
    }
    handler(event, {}, (_, body) => {
      expect(body).toEqual({ foo: 'bar' })
    })
  })

  test('It should handle invalid JSON as an UnprocessableEntity', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    handler.use(jsonBodyParser())

    // invokes the handler
    const event = {
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'make it broken' + JSON.stringify({ foo: 'bar' })
    }
    handler(event, {}, (err) => {
      expect(err.message).toEqual('Content type defined as JSON but an invalid JSON was provided')
    })
  })

  test('It shouldn\'t process the body if no header is passed', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    handler.use(jsonBodyParser())

    // invokes the handler
    const event = {
      body: JSON.stringify({ foo: 'bar' })
    }
    handler(event, {}, (_, body) => {
      expect(body).toEqual('{"foo":"bar"}')
    })
  })
})
