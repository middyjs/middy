const middy = require('../../core')
const urlEncodePathParser = require('../')

describe('📦 Middleware URL Encoded Path Parser', () => {
  test('It should decode simple url encoded requests', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.pathParameters) // propagates the body as response
    })

    handler.use(urlEncodePathParser())

    // invokes the handler
    const event = {
      pathParameters: {
        char: encodeURIComponent('Mîddy')
      }
    }

    handler(event, {}, (_, body) => {
      expect(body).toEqual({
        char: 'Mîddy'
      })
    })
  })

  test('It should throw error', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.pathParameters) // propagates the body as response
    })

    handler.use(urlEncodePathParser())

    const event = {
      pathParameters: {
        char: '%E0%A4%A'
      }
    }

    handler(event, {}, (err, body) => {
      expect(err.message).toEqual('URI malformed')
      expect(body).toEqual(undefined)
    })
  })
})
