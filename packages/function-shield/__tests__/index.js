const { invoke } = require('../../test-helpers')
const middy = require('../../core')
const functionShield = require('../')

describe('📦  Middleware FunctionShield', () => {
  test('Should not affect function execution', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, event)
    })

    handler.use(functionShield())

    const result = await invoke(handler)
    expect(result).toEqual({})
  })
})
