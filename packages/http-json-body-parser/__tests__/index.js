import { test } from 'node:test'
import { equal, deepEqual, match } from 'node:assert/strict'
import middy from '../../core/index.js'
import jsonBodyParser from '../index.js'

const defaultContext = {
  getRemainingTimeInMillis: () => 1000
}

test('It should parse a JSON request', async (t) => {
  const handler = middy((event) => {
    return event // propagates the processed event as a response
  })

  handler.use(jsonBodyParser())

  // invokes the handler
  const event = {
    headers: {
      'Content-Type': 'application/json'
    },
    body: '{ "foo" :   "bar"   }'
  }

  const processedEvent = await handler(event, defaultContext)

  deepEqual(processedEvent.body, { foo: 'bar' })
})

test('It should parse a JSON with a suffix MediaType request', async (t) => {
  const handler = middy((event) => {
    return event // propagates the processed event as a response
  })

  handler.use(jsonBodyParser())

  // invokes the handler
  const event = {
    headers: {
      'Content-Type': 'application/vnd+json'
    },
    body: '{ "foo" :   "bar"   }'
  }

  const processedEvent = await handler(event, defaultContext)

  deepEqual(processedEvent.body, { foo: 'bar' })
})

test('It should use a reviver when parsing a JSON request', async (t) => {
  const handler = middy((event) => {
    return event.body // propagates the body as a response
  })
  const reviver = (_) => _
  handler.use(jsonBodyParser({ reviver }))

  // invokes the handler
  const jsonString = JSON.stringify({ foo: 'bar' })
  const event = {
    headers: {
      'Content-Type': 'application/json'
    },
    body: jsonString
  }
  const jsonParseSpy = t.mock.method(JSON, 'parse')

  await handler(event, defaultContext)

  deepEqual(jsonParseSpy.mock.calls[0].arguments, [jsonString, reviver])
})

test('It should parse a JSON request with lowercase header', async (t) => {
  const handler = middy((event) => {
    return event.body // propagates the body as a response
  })

  handler.use(jsonBodyParser())

  // invokes the handler
  const event = {
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ foo: 'bar' })
  }

  const body = await handler(event, defaultContext)

  deepEqual(body, { foo: 'bar' })
})

test('It should handle invalid JSON as an UnprocessableEntity', async (t) => {
  const handler = middy((event) => {
    return event.body // propagates the body as a response
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
    await handler(event, defaultContext)
  } catch (e) {
    equal(e.statusCode, 415)
    equal(e.message, 'Invalid or malformed JSON was provided')
    match(e.cause.message, /^Unexpected token/)
  }
})

test('It should handle undefined as an UnprocessableEntity', async (t) => {
  const handler = middy((event) => {
    return event.body // propagates the body as a response
  })

  handler.use(jsonBodyParser())

  // invokes the handler
  const event = {
    headers: {
      'Content-Type': 'application/json'
    },
    body: undefined
  }

  try {
    await handler(event, defaultContext)
  } catch (e) {
    equal(e.statusCode, 415)
    equal(e.message, 'Invalid or malformed JSON was provided')
    equal(e.cause.data, undefined)
  }
})

test("It shouldn't process the body if no header is passed", async (t) => {
  const handler = middy((event) => {
    return event.body // propagates the body as a response
  })

  handler.use(jsonBodyParser({ disableContentTypeError: true }))

  // invokes the handler
  const event = {
    headers: {},
    body: JSON.stringify({ foo: 'bar' })
  }

  const body = await handler(event, defaultContext)

  equal(body, '{"foo":"bar"}')
})

test("It shouldn't process the body and throw error if no header is passed", async (t) => {
  const handler = middy((event) => {
    return event.body // propagates the body as a response
  })

  handler.use(jsonBodyParser({ disableContentTypeError: false }))

  // invokes the handler
  const event = {
    headers: {},
    body: JSON.stringify({ foo: 'bar' })
  }

  try {
    await handler(event, defaultContext)
  } catch (e) {
    equal(e.statusCode, 415)
    equal(e.message, 'Unsupported Media Type')
    equal(e.cause.data, undefined)
  }
})

test('It should handle undefined body if no header', async (t) => {
  /**
   * test checks that if the body is undefined, no content-type header is passed and disableContentTypeError is true,
   * the handler should process the request and do not throw an error
   */
  const handler = middy((event) => {
    return event.body // propagates the body as a response
  })

  handler.use(jsonBodyParser({ disableContentTypeError: true }))

  // invokes the handler
  const event = {
    headers: {},
    body: undefined
  }

  const body = await handler(event, defaultContext)
  equal(body, undefined)
})

test('It should handle a base64 body', async (t) => {
  const handler = middy((event) => {
    return event.body // propagates the body as a response
  })

  handler.use(jsonBodyParser())

  // invokes the handler
  const data = JSON.stringify({ foo: 'bar' })
  const base64Data = Buffer.from(data).toString('base64')
  const event = {
    headers: {
      'Content-Type': 'application/json'
    },
    isBase64Encoded: true,
    body: base64Data
  }

  const body = await handler(event, defaultContext)

  deepEqual(body, { foo: 'bar' })
})

test('It should handle invalid base64 JSON as an UnprocessableEntity', async (t) => {
  const handler = middy((event) => {
    return event.body // propagates the body as a response
  })

  handler.use(jsonBodyParser())

  // invokes the handler
  const data = 'make it broken' + JSON.stringify({ foo: 'bar' })
  const base64Data = Buffer.from(data).toString('base64')
  const event = {
    headers: {
      'Content-Type': 'application/json'
    },
    isBase64Encoded: true,
    body: base64Data
  }

  try {
    await handler(event, defaultContext)
  } catch (e) {
    equal(e.message, 'Invalid or malformed JSON was provided')
    match(e.cause.message, /^Unexpected token/)
  }
})
