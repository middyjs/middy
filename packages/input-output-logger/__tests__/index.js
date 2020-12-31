import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import inputOutputLogger from '../index.js'

// Silence logging
console.log = () => {}

test('It should log event and response', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event, context) => {
    return { message: 'hello world' }
  })

  handler
    .use(inputOutputLogger({ logger }))

  await handler({ foo: 'bar', fuu: 'baz' })

  t.true(logger.calledWith({ event: { foo: 'bar', fuu: 'baz' } }))
  t.true(logger.calledWith({ response: { message: 'hello world' } }))
})

test('It should omit paths', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event, context) => {
    return { message: 'hello world', bar: 'bi' }
  })

  handler
    .use(inputOutputLogger({ logger, omitPaths: ['event.foo', 'response.bar'] }))

  await handler({ foo: 'bar', fuu: 'baz' })

  t.true(logger.calledWith({ event: { foo: 'bar', fuu: 'baz' } }))
  t.true(logger.calledWith({ response: { message: 'hello world', bar: 'bi' } }))
})
test('It should skip paths that do not exist', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event, context) => {
    return 'yo'
  })

  handler
    .use(inputOutputLogger({ logger, omitPaths: ['event.zooloo', 'event.foo.hoo', 'response.bar'] }))

  await handler({ foo: 'bar', fuu: 'baz' })

  t.true(logger.calledWith({ event: { foo: 'bar', fuu: 'baz' } }))
  t.true(logger.calledWith({ response: 'yo' }))
})

test('Skipped parts should be present in the response', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event, context) => {
    return { foo: [{ foo: 'bar', fuu: 'baz' }] }
  })

  handler
    .use(inputOutputLogger({ logger, omitPaths: ['event.zooloo', 'event.foo.hoo', 'response.foo[0].foo'] }))

  const response = await handler({ foo: 'bar', fuu: 'baz' })

  t.true(logger.calledWith({ event: { foo: 'bar', fuu: 'baz' } }))
  t.true(logger.calledWith({ response: { foo: [{ foo: 'bar', fuu: 'baz' }] } }))

  t.deepEqual(response, { foo: [{ foo: 'bar', fuu: 'baz' }] })
})


