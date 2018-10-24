const middy = require('../../middy')
const functionShield = require('../functionShield')

describe('📦  Middleware FunctionShield', () => {
  test('Should not affect function execution', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event) // propagates the body as a response
    })

    handler.use(functionShield())

    // invokes the handler
    const event = {}
    handler(event, {}, (_, result) => {
      expect(result).toEqual({})
    })
  })
})
