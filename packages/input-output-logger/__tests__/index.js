const middy = require('../../core')
const inputOutputLogger = require('../')

describe('📦 Middleware Input Output Logger', () => {
  test('It should log event and response', () => {
    const logger = jest.fn()

    const handler = middy((event, context, cb) => {
      cb(null, { message: 'hello world' })
    })

    handler
      .use(inputOutputLogger({ logger }))

    // run the handler
    handler({ foo: 'bar', fuu: 'baz' }, {}, (_, response) => {
      expect(logger).toHaveBeenCalledWith({ event: {foo: 'bar', fuu: 'baz'} })
      expect(logger).toHaveBeenCalledWith({ response: {message: 'hello world'} })
    })
  })
})
