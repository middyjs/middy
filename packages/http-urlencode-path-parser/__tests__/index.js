import test from 'ava'
import middy from '../../core/index.js'
import urlEncodePathParser from '../index.js'

test('It should decode simple url encoded requests', async (t) => {
  const handler = middy((event, context) => {
    return event.pathParameters // propagates the body as response
  })

  handler.use(urlEncodePathParser())

  // invokes the handler
  const event = {
    pathParameters: {
      char: encodeURIComponent('Mîddy')
    }
  }

  await handler(event, {}, (_, body) => {
    t.deepEqual(body, {
      char: 'Mîddy'
    })
  })
})

test('It should throw error', async (t) => {
  const handler = middy((event, context) => {
    return event.pathParameters // propagates the body as response
  })

  handler.use(urlEncodePathParser())

  const event = {
    pathParameters: {
      char: '%E0%A4%A'
    }
  }

  await handler(event, {}, (err, body) => {
    t.is(err.message, 'URI malformed')
    t.is(body, undefined)
  })
})

