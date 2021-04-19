const test = require('ava')
const sinon = require('sinon')
const middy = require('../../core/index.js')
const inputOutputLogger = require('../index.js')

// Silence logging
console.log = () => {}

test('It should log event and response', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event, context) => {
    return { message: 'hello world' }
  })

  handler.use(inputOutputLogger({ logger }))

  await handler({ foo: 'bar', fuu: 'baz' })

  t.true(logger.calledWith({ event: { foo: 'bar', fuu: 'baz' } }))
  t.true(logger.calledWith({ response: { message: 'hello world' } }))
})

test('It should throw error when invalid logger', async (t) => {
  const logger = false

  const handler = middy((event, context) => {
    return { message: 'hello world' }
  })

  try {
    handler.use(inputOutputLogger({ logger }))
  } catch (e) {
    t.is(
      e.message,
      'Middleware must be an object containing at least one key among "before", "after", "onError"'
    )
  }
})

test('It should omit paths', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event, context) => {
    return { message: 'hello world', bar: 'bi' }
  })

  handler.use(
    inputOutputLogger({ logger, omitPaths: ['event.foo', 'response.bar'] })
  )

  const response = await handler({ foo: 'bar', fuu: 'baz' })

  t.true(logger.calledWith({ event: { fuu: 'baz' } }))
  t.true(logger.calledWith({ response: { message: 'hello world' } }))

  t.deepEqual(response, { message: 'hello world', bar: 'bi' })
})
test('It should skip paths that do not exist', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event, context) => {
    return 'yo'
  })

  handler.use(
    inputOutputLogger({
      logger,
      omitPaths: ['event.zooloo', 'event.foo.hoo', 'response.bar']
    })
  )

  await handler({ foo: 'bar', fuu: 'baz' })

  t.true(logger.calledWith({ event: { foo: 'bar', fuu: 'baz' } }))
  t.true(logger.calledWith({ response: 'yo' }))
})

test('Skipped parts should be present in the response', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event, context) => {
    return { foo: [{ foo: 'bar', fuu: 'baz' }] }
  })

  handler.use(
    inputOutputLogger({
      logger,
      omitPaths: ['event.zooloo', 'event.foo.hoo', 'response.foo[0].foo']
    })
  )

  const response = await handler({ foo: 'bar', fuu: 'baz' })

  t.true(logger.calledWith({ event: { foo: 'bar', fuu: 'baz' } }))
  t.true(logger.calledWith({ response: { foo: [{ foo: 'bar', fuu: 'baz' }] } }))

  t.deepEqual(response, { foo: [{ foo: 'bar', fuu: 'baz' }] })
})
