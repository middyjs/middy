import test from 'ava'
import sinon from 'sinon'
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
    body: '{ "foo" :   "bar"   }'
  }

  const processedEvent = await handler(event, defaultContext)

  t.deepEqual(processedEvent.body, { foo: 'bar' })
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
    body: jsonString
  }
  const jsonParseSpy = sinon.spy(JSON, 'parse')

  await handler(event, defaultContext)

  t.true(jsonParseSpy.calledWith(jsonString, reviver))
})

test('It should handle invalid JSON as an UnprocessableEntity', async (t) => {
  const handler = middy((event) => {
    return event.body // propagates the body as a response
  })

  handler.use(jsonBodyParser())

  // invokes the handler
  const event = {
    body: 'make it broken' + JSON.stringify({ foo: 'bar' })
  }

  try {
    await handler(event, defaultContext)
  } catch (e) {
    t.is(e.message, 'Invalid or malformed JSON was provided')
    t.is(e.cause.data.message, 'Unexpected token m in JSON at position 0')
  }
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
    isBase64Encoded: true,
    body: base64Data
  }

  const body = await handler(event, defaultContext)

  t.deepEqual(body, { foo: 'bar' })
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
    isBase64Encoded: true,
    body: base64Data
  }

  try {
    await handler(event, defaultContext)
  } catch (e) {
    t.is(e.message, 'Invalid or malformed JSON was provided')
    t.is(e.cause.data.message, 'Unexpected token m in JSON at position 0')
  }
})
