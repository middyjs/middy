const { invoke } = require('../../test-helpers')
const middy = require('../../core')
const errorLogger = require('../')

describe('📦 Middleware Error Logger', () => {
  test('It should log errors and propagate the error', async () => {
    expect.assertions(3)

    const error = new Error('something bad happened')
    const logger = jest.fn()

    const handler = middy((event, context, cb) => {
      cb(error)
    })

    handler
      .use(errorLogger({ logger }))

    let response

    try {
      response = await invoke(handler)
    } catch (err) {
      expect(logger).toHaveBeenCalledWith(error)
      expect(response).toBeUndefined()
      expect(err).toBe(error)
    }
  })
})
