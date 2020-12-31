import test from 'ava'
import middy from '../../core/index.js'
import urlEncodeBodyParser from '../index.js'

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

test('It shouldn\'t process the body if no header is passed', async (t) => {
  const handler = middy((event, context) => {
    return event.body // propagates the body as a response
  })

  handler.use(urlEncodeBodyParser())

  // invokes the handler
  const event = {
    body: JSON.stringify({ foo: 'bar' })
  }

  const body = await handler(event)

  t.is(body, '{"foo":"bar"}')
})

