import test from 'ava'
import middy from '../../core/index.js'
import urlEncodeBodyParser from '../index.js'

// const event = {}
const defaultContext = {
  getRemainingTimeInMillis: () => 1000
}

test('It should decode complex url encoded requests', async (t) => {
  const handler = middy((event, context) => {
    return event // propagates the body as response
  })

  handler.use(urlEncodeBodyParser())

  // invokes the handler
  const body = 'a[b][c][d]=i'
  const event = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body
  }

  const processedEvent = await handler(event, defaultContext)

  t.deepEqual(processedEvent.body, {
    a: {
      b: {
        c: {
          d: 'i'
        }
      }
    }
  })
})

test('It should default when body is undefined', async (t) => {
  const handler = middy((event) => {
    return event // propagates the processed event as a response
  })

  handler.use(urlEncodeBodyParser())

  // invokes the handler
  const event = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }
  }

  const processedEvent = await handler(event, defaultContext)

  t.deepEqual(processedEvent.body, {})
})

test('It should not process the body if no headers are passed', async (t) => {
  const handler = middy((event) => {
    return event.body // propagates the body as a response
  })

  handler.use(urlEncodeBodyParser({ disableContentTypeError: true }))

  // invokes the handler
  const event = {
    headers: {},
    body: 'a[b][c][d]=i'
  }

  const body = await handler(event, defaultContext)

  t.is(body, 'a[b][c][d]=i')
})

test("It shouldn't process the body and throw error if no header is passed", async (t) => {
  const handler = middy((event) => {
    return event.body // propagates the body as a response
  })

  handler.use(urlEncodeBodyParser({ disableContentTypeError: false }))

  // invokes the handler
  const event = {
    headers: {},
    body: 'a[b][c][d]=i'
  }

  try {
    await handler(event, defaultContext)
  } catch (e) {
    t.is(e.statusCode, 415)
    t.is(e.message, '@middy/http-urlencode-body-parser Unsupported Media Type')
    t.is(e.cause, undefined)
  }
})

test('It should not process the body if malformed body is passed', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(urlEncodeBodyParser())

  // invokes the handler
  const event = {
    body: JSON.stringify({ foo: 'bar' }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }

  try {
    await handler(event, defaultContext)
  } catch (e) {
    t.is(e.statusCode, 415)
  }
})

test('It should handle base64 body', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(urlEncodeBodyParser())

  const event = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: Buffer.from('a=a&b=b').toString('base64'),
    isBase64Encoded: true
  }

  const body = await handler(event, defaultContext)

  t.deepEqual(body, { a: 'a', b: 'b' })
})
