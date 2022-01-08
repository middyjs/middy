const test = require('ava')
const middy = require('../../core/index.js')
const urlEncodeBodyParser = require('../index.js')

test('It should decode complex url encoded requests', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as response
  })

  handler.use(urlEncodeBodyParser())

  // invokes the handler
  const event = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: 'a[b][c][d]=i'
  }

  const body = await handler(event)

  t.deepEqual(body, {
    a: {
      b: {
        c: {
          d: 'i'
        }
      }
    }
  })
})

test('It should not process the body if no headers are passed', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(urlEncodeBodyParser())

  // invokes the handler
  const event = {
    headers: {},
    body: JSON.stringify({ foo: 'bar' })
  }

  const body = await handler(event)

  t.is(body, '{"foo":"bar"}')
})

test('It should not process the body if no header is passed', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(urlEncodeBodyParser())

  // invokes the handler
  const event = {
    body: JSON.stringify({ foo: 'bar' }),
    headers: {}
  }

  const body = await handler(event)

  t.is(body, '{"foo":"bar"}')
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

  const body = await handler(event)

  t.deepEqual(body, { a: 'a', b: 'b' })
})
