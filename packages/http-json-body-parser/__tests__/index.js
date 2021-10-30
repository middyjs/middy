const test = require('ava')
const sinon = require('sinon')
const middy = require('../../core/index.js')
const jsonBodyParser = require('../index.js')

test('It should parse a JSON request', async (t) => {
  const handler = middy((event, context) => {
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

  const processedEvent = await handler(event)

  t.deepEqual(processedEvent.body, { foo: 'bar' })
  t.deepEqual(processedEvent.rawBody, '{ "foo" :   "bar"   }')
})

test('It should parse a JSON with a suffix MediaType request', async (t) => {
  const handler = middy((event, context) => {
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

  const processedEvent = await handler(event)

  t.deepEqual(processedEvent.body, { foo: 'bar' })
  t.deepEqual(processedEvent.rawBody, '{ "foo" :   "bar"   }')
})

test('It should use a reviver when parsing a JSON request', async (t) => {
  const handler = middy((event, context) => {
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
  const jsonParseSpy = sinon.spy(JSON, 'parse')

  await handler(event)

  t.true(jsonParseSpy.calledWith(jsonString, reviver))
})

test('It should parse a JSON request with lowercase header', async (t) => {
  const handler = middy((event, context) => {
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

  const body = await handler(event)

  t.deepEqual(body, { foo: 'bar' })
})

test('It should handle invalid JSON as an UnprocessableEntity', async (t) => {
  const handler = middy((event, context) => {
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
    await handler(event)
  } catch (err) {
    t.is(
      err.message,
      'Content type defined as JSON but an invalid JSON was provided'
    )
  }
})

test("It shouldn't process the body if no header is passed", async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(jsonBodyParser())

  // invokes the handler
  const event = {
    body: JSON.stringify({ foo: 'bar' })
  }

  const body = await handler(event)

  t.is(body, '{"foo":"bar"}')
})

test('It should handle a base64 body', async (t) => {
  const handler = middy((event, context) => {
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

  const body = await handler(event)

  t.deepEqual(body, { foo: 'bar' })
})

test('It should handle invalid base64 JSON as an UnprocessableEntity', async (t) => {
  const handler = middy((event, context) => {
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
    await handler(event)
  } catch (err) {
    t.is(
      err.message,
      'Content type defined as JSON but an invalid JSON was provided'
    )
  }
})
