const { invoke } = require('../../test-helpers')
const middy = require('../../core')
const jsonBodyParser = require('../')

describe('📦  Middleware JSON Body Parser', () => {
  test('It should parse a JSON request', async () => {
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

    const body = await invoke(handler, event)

    expect(body).toEqual({ foo: 'bar' })
  })

  test('It should use a reviver when parsing a JSON request', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })
    const reviver = _ => _
    handler.use(jsonBodyParser({ reviver }))

    // invokes the handler
    const event = {
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ foo: 'bar' })
    }
    const JSONparseSpy = jest.spyOn(JSON, 'parse')

    await invoke(handler, event)

    expect(JSONparseSpy).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar' }), reviver)

    JSONparseSpy.mockRestore()
  })

  test('It should parse a JSON request with lowercase header', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    handler.use(jsonBodyParser())

    // invokes the handler
    const event = {
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ foo: 'bar' })
    }

    const body = await invoke(handler, event)

    expect(body).toEqual({ foo: 'bar' })
  })

  test('It should handle invalid JSON as an UnprocessableEntity', async () => {
    expect.assertions(1)

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

    try {
      await invoke(handler, event)
    } catch (err) {
      expect(err.message).toEqual('Content type defined as JSON but an invalid JSON was provided')
    }
  })

  test('It shouldn\'t process the body if no header is passed', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    handler.use(jsonBodyParser())

    // invokes the handler
    const event = {
      body: JSON.stringify({ foo: 'bar' })
    }

    const body = await invoke(handler, event)

    expect(body).toEqual('{"foo":"bar"}')
  })
})
