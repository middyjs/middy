const middy = require('../../core')
const errorLogger = require('../')

describe('📦 Middleware Error Logger', () => {
  test('It should log errors and propagate the error', (endTest) => {
    const error = new Error('something bad happened')
    const logger = jest.fn()

    const handler = middy((event, context, cb) => {
      cb(error)
    })

    handler
      .use(errorLogger({ logger }))

    // run the handler
    handler({}, {}, (err, response) => {
      expect(logger).toHaveBeenCalledWith(error)
      expect(err).toBe(error)
      expect(response).toBeUndefined()
      endTest()
    })
  })
})
