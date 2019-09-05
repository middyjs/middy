const { invoke } = require('../../test-helpers')
const middy = require('../../core')
const inputOutputLogger = require('../')

describe('📦 Middleware Input Output Logger', () => {
  test('It should log event and response', async () => {
    const logger = jest.fn()

    const handler = middy((event, context, cb) => {
      cb(null, { message: 'hello world' })
    })

    handler
      .use(inputOutputLogger({ logger }))

    await invoke(handler, { foo: 'bar', fuu: 'baz' })

    expect(logger).toHaveBeenCalledWith({ event: { foo: 'bar', fuu: 'baz' } })
    expect(logger).toHaveBeenCalledWith({ response: { message: 'hello world' } })
  })
})
