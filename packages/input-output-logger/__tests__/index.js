import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import inputOutputLogger from '../index.js'

// Silence logging
console.log = () => {}

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}
const defaultContext = context

test('It should log event and response', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event, context) => {
    return { message: 'hello world' }
  })


  handler
    .use(inputOutputLogger({ logger }))

  const event = { foo: 'bar', fuu: 'baz' }
  await handler(event, context)

  t.true(logger.calledWith({ event }))
  t.true(logger.calledWith({ response: { message: 'hello world' } }))
})

test('It should throw error when invalid logger', async (t) => {
  const logger = false

  const handler = middy((event, context) => {
    return { message: 'hello world' }
  })

  try {
    handler
      .use(inputOutputLogger({ logger }))
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

  handler
    .use(inputOutputLogger({ logger, omitPaths: ['event.foo', 'response.bar'] }))

  const event = { foo: 'bar', fuu: 'baz' }
  const response = await handler(event, context)

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

  const event = { foo: 'bar', fuu: 'baz' }
  await handler(event, context)

  t.true(logger.calledWith({ event }))
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

  const event = { foo: 'bar', fuu: 'baz' }
  const response = await handler(event, context)

  t.true(logger.calledWith({ event }))
  t.true(logger.calledWith({ response: { foo: [{ foo: 'bar', fuu: 'baz' }] } }))

  t.deepEqual(response, { foo: [{ foo: 'bar', fuu: 'baz' }] })
})

test('Should include the AWS lambda context', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event, context) => {
    t.true(logger.calledWith({ event, context: {functionName: 'test', awsRequestId: 'xxxxx' } }))
    return event
  })

  handler.use(inputOutputLogger({ logger, awsContext: true }))

  const event = { foo: 'bar', fuu: 'baz' }
  const context = { ...defaultContext, functionName: 'test', awsRequestId: 'xxxxx' }
  const response = await handler(event, context)

  t.deepEqual(response, event)

  t.true(logger.calledWith({ response: event, context: {functionName: 'test', awsRequestId: 'xxxxx' } }))
})
