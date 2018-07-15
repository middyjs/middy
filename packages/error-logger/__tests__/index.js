const middy = require('../../core')
const errorLogger = require('../')

describe('📦 Middleware Error Logger', (endTest) => {
  test('It should log errors and propagate the error', () => {
    const logger = jest.fn()
    const error = new Error('something bad happened')

    const handler = middy((event, context, cb) => {
      cb(error)
    })

    handler
      .use(errorLogger({ logger }))

    // run the handler
    handler({}, {}, (err, response) => {
      expect(logger).toHaveBeenCalledWith(error)
      expect(err).toBe(error)
      expect(response).toBe(null)
      endTest()
    })
  })
})
