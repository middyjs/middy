const test = require('ava')
const middy = require('../../core/index.js')
const urlEncodePathParser = require('../index.js')

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

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

  const response = await handler(event, context)
  t.deepEqual(response, {
    char: 'Mîddy'
  })
})

test('It should skip if no path parameters', async (t) => {
  const handler = middy((event, context) => {
    return event.pathParameters // propagates the body as response
  })

  handler.use(urlEncodePathParser())

  // invokes the handler
  const event = {}

  const response = await handler(event, context)
  t.is(response, undefined)
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

  try {
    await handler(event, context)
  } catch (e) {
    t.is(e.message, 'URI malformed')
  }
})
